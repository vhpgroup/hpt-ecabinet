// ============================================================
// SMOKE TEST — server/src (Node) — HÀM THUẦN, KHÔNG DB, KHÔNG HTTP/SOCKET.
//
// CÁCH CHẠY:
//   node server/test/smoke.mjs
//
// Ràng buộc nền tảng (đã xác nhận trước: mở HTTP server/socket trong sandbox
// giết tiến trình) — file này CHỈ import trực tiếp các hàm THUẦN đã export từ
// server/src/{acl,guard,access,actions,open,db}.js và gọi chúng với dữ liệu tự
// dựng (không đọc DB thật — access.js cần buildAccessCtx()/query() thì ta build
// tay object `ctx` tương đương, KHÔNG gọi buildAccessCtx()).
//
// Phủ các hành vi MỚI trong đợt vá P0-1..P0-4 / P1-5..P1-8 (xem
// /agent/workspace/reports/dev-backend.md để đối chiếu đầy đủ):
//   - P0-1 cô lập dữ liệu theo đơn vị (meetings/votes/feedbacks)
//   - P0-2 ACL unit_admin tạo meetings
//   - P0-3 canReviewDocumentAsMeetingMember + guardDocuments (thành phần phiên duyệt)
//   - P0-4 ký số ballot (SIGN_PIN_RE, buildBallotSignature) + ẩn signature phiếu kín
//   - P1-5 vote draft (validatePatch enum status)
//   - P1-6 feedbacks (ACL + guardFeedbacks + validatePatch)
//   - P1-7 whitelist định dạng tệp (validatePatch documents)
//   - P1-8 Unicode round-trip (tiếng Việt NFC/NFD + emoji qua JSON + qua guard)
//
// Runner tự viết (không phụ thuộc thư viện ngoài — môi trường có thể chặn npm
// registry): mỗi ca là 1 hàm đồng bộ/async, throw => FAIL. In bảng PASS/FAIL,
// exit code != 0 nếu có ca lỗi (dùng được trong CI).
// ============================================================
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { ACL, MANAGE, allowed } from '../src/acl.js';
import { canReviewDocumentAsMeetingMember, guardPatch, validatePatch } from '../src/guard.js';
import {
  canReadFeedback, canSeeMeetingList, projectMeeting, projectVote,
} from '../src/access.js';
import { SIGN_PIN_RE, buildBallotSignature } from '../src/actions.js';
import { meetingInvolvesUnit } from '../src/open.js';
import {
  signRequestV4, uriEncode, isDataUri, decodeDataUri, encodeDataUri,
  documentKey, guideKey, externalizeDocumentWrite, inlineDocumentRead,
  externalizeGuideWrite, inlineGuideRead,
  presignV4, signingKey, documentStorageKeys, guideStorageKeys,
  downloadMode, downloadModeFrom, inlineReadEnabled,
  projectDocumentRead, projectGuideRead,
} from '../src/blob.js';
import { COLLECTIONS } from '../src/db.js';

// ---------------- Runner tối giản ----------------
const results = [];
let group = '';
function Group(name) { group = name; }
async function Case(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ group, name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ [${group}] ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    results.push({ group, name, ok: false, ms: Date.now() - t0, detail: e?.message ?? String(e) });
    console.log(`  ✗ [${group}] ${name} — ${e?.message ?? e}`);
  }
}
function report() {
  console.log('\n================ KẾT QUẢ SMOKE TEST (Node, theo nhóm) ================');
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`${'Nhóm'.padEnd(28)} Pass  Fail  Tổng`);
  console.log('-'.repeat(50));
  let totalPass = 0, totalFail = 0;
  for (const g of groups) {
    const rows = results.filter((r) => r.group === g);
    const pass = rows.filter((r) => r.ok).length;
    const fail = rows.length - pass;
    totalPass += pass; totalFail += fail;
    console.log(`${g.padEnd(28)} ${String(pass).padStart(4)}  ${String(fail).padStart(4)}  ${String(rows.length).padStart(4)}`);
  }
  console.log('-'.repeat(50));
  console.log(`${'TỔNG'.padEnd(28)} ${String(totalPass).padStart(4)}  ${String(totalFail).padStart(4)}  ${String(results.length).padStart(4)}`);
  if (totalFail > 0) {
    console.log('\n---- CHI TIẾT CA THẤT BẠI ----');
    for (const r of results.filter((r) => !r.ok)) console.log(`  ✗ [${r.group}] ${r.name}: ${r.detail}`);
    console.log(`\nKẾT LUẬN: THẤT BẠI (${totalFail} ca lỗi / ${results.length} ca).`);
    return 1;
  }
  console.log(`KẾT LUẬN: TẤT CẢ ${results.length} CA PASS. ✅`);
  return 0;
}

// ---------------- Fixtures dùng chung ----------------
const U = (sub, role) => ({ sub, role, name: sub });
const sha256hex = (t) => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');

console.log('eCabinet Node — smoke test hàm thuần (không HTTP/DB)\n');

// ============================================================
// NHÓM 1 — P0-2: ACL unit_admin tạo meetings / P1-6 feedbacks ACL
// ============================================================
Group('1-ACL');
await Case('ACL.meetings.create: unit_admin ĐƯỢC tạo (P0-2)', () => {
  assert.equal(allowed(ACL.meetings.create, { user: U('u-qtdv', 'unit_admin') }, null, {}), true);
});
await Case('ACL.meetings.create: delegate KHÔNG được tạo', () => {
  assert.equal(allowed(ACL.meetings.create, { user: U('u-x', 'delegate') }, null, {}), false);
});
await Case('ACL.meetings.create: MANAGE (admin/secretary/chairman) vẫn tạo được như trước', () => {
  for (const role of MANAGE) {
    assert.equal(allowed(ACL.meetings.create, { user: U('u-x', role) }, null, {}), true, `role=${role}`);
  }
});
await Case('ACL.feedbacks: create=any (ai đăng nhập cũng tạo được)', () => {
  assert.equal(allowed(ACL.feedbacks.create, { user: U('u-x', 'delegate') }, null, {}), true);
});
await Case('ACL.feedbacks: remove chỉ admin', () => {
  assert.equal(allowed(ACL.feedbacks.remove, { user: U('u-x', 'admin') }, {}, null), true);
  assert.equal(allowed(ACL.feedbacks.remove, { user: U('u-x', 'delegate') }, {}, null), false);
});

// ============================================================
// NHÓM 2 — P0-1: CÔ LẬP DỮ LIỆU THEO ĐƠN VỊ (access.js, hàm thuần + ctx tự dựng)
// ============================================================
Group('2-MULTITENANT-ACCESS');

// unitOfUser giả lập: u-a/u-b thuộc un-1; u-c thuộc un-2
const unitOfUser = (uid) => ({ 'u-a': 'un-1', 'u-b': 'un-1', 'u-c': 'un-2', 'u-tk': 'un-1' }[uid] ?? null);

await Case('meetingInvolvesUnit (open.js, TÁI SỬ DỤNG ở access.js): chủ trì cùng đơn vị -> true', () => {
  const m = { chairId: 'u-a', secretaryId: 'u-tk', participants: [] };
  assert.equal(meetingInvolvesUnit(m, 'un-1', unitOfUser), true);
});
await Case('meetingInvolvesUnit: không ai cùng đơn vị -> false', () => {
  const m = { chairId: 'u-c', secretaryId: 'u-c', participants: [{ userId: 'u-c' }] };
  assert.equal(meetingInvolvesUnit(m, 'un-1', unitOfUser), false);
});
await Case('meetingInvolvesUnit: unitId rỗng/null -> false (không rơi vào so sánh null===null)', () => {
  const m = { chairId: null, secretaryId: null, participants: [] };
  assert.equal(meetingInvolvesUnit(m, null, unitOfUser), false);
});

await Case('canSeeMeetingList: participant trực tiếp -> true (không cần cùng đơn vị)', () => {
  const m = { id: 'm1', participants: [{ userId: 'u-c' }] };
  const ctx = { myMeetingIds: new Set(['m1']), myUnitMeetingIds: new Set() };
  assert.equal(canSeeMeetingList(m, U('u-c', 'delegate'), ctx), true);
});
await Case('canSeeMeetingList: CÙNG ĐƠN VỊ nhưng KHÔNG phải participant -> true (P0-1 mở rộng)', () => {
  const m = { id: 'm2', participants: [{ userId: 'u-a' }] };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set(['m2']) }; // u-b cùng đơn vị u-a
  assert.equal(canSeeMeetingList(m, U('u-b', 'delegate'), ctx), true);
});
await Case('canSeeMeetingList: KHÁC đơn vị, không phải participant -> false (đã vá R1)', () => {
  const m = { id: 'm3', participants: [{ userId: 'u-a' }] };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set() }; // u-c không cùng đơn vị/participant
  assert.equal(canSeeMeetingList(m, U('u-c', 'delegate'), ctx), false);
});
await Case('canSeeMeetingList: admin luôn true (isManage)', () => {
  const m = { id: 'm4', participants: [] };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set() };
  assert.equal(canSeeMeetingList(m, U('u-admin', 'admin'), ctx), true);
});

await Case('projectMeeting: người NGOÀI thành phần trực tiếp (dù thấy nhờ cùng đơn vị) vẫn bị ẩn minutes/conclusions', () => {
  const m = { participants: [{ userId: 'u-a' }], minutes: { content: 'mật' }, conclusions: [{ id: 'c1' }] };
  const out = projectMeeting(m, U('u-b', 'delegate')); // u-b không phải participant của m (dù cùng đơn vị u-a)
  assert.equal(out.minutes, null);
  assert.deepEqual(out.conclusions, []);
});
await Case('projectMeeting: participant trực tiếp thấy đầy đủ', () => {
  const m = { participants: [{ userId: 'u-a' }], minutes: { content: 'x' }, conclusions: [{ id: 'c1' }] };
  const out = projectMeeting(m, U('u-a', 'delegate'));
  assert.equal(out.minutes.content, 'x');
  assert.equal(out.conclusions.length, 1);
});

await Case('projectVote (poll ngoài họp): CÙNG ĐƠN VỊ người tạo -> thấy dù không eligible (P0-1 vá bug hiển thị mọi người)', () => {
  const vote = { meetingId: null, eligibleIds: ['u-tk'], createdBy: 'u-a', secret: false };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set(), myUnitId: 'un-1', unitOfUser };
  const out = projectVote(vote, U('u-b', 'delegate'), ctx); // u-b cùng đơn vị un-1 với createdBy u-a
  assert.notEqual(out, null);
});
await Case('projectVote (poll ngoài họp): KHÁC đơn vị, không eligible, không phải người tạo -> null (404)', () => {
  const vote = { meetingId: null, eligibleIds: ['u-tk'], createdBy: 'u-a', secret: false };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set(), myUnitId: 'un-2', unitOfUser };
  const out = projectVote(vote, U('u-c', 'delegate'), ctx);
  assert.equal(out, null);
});
await Case('projectVote (trong họp): thấy nếu phiên thuộc đơn vị mình dù KHÔNG eligible', () => {
  const vote = { meetingId: 'm-x', eligibleIds: ['u-tk'], createdBy: 'u-tk', secret: false };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set(['m-x']), myUnitId: 'un-1', unitOfUser };
  const out = projectVote(vote, U('u-a', 'delegate'), ctx);
  assert.notEqual(out, null);
});
await Case('projectVote (trong họp): đơn vị hoàn toàn không liên quan -> null (404)', () => {
  const vote = { meetingId: 'm-x', eligibleIds: ['u-tk'], createdBy: 'u-tk', secret: false };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set(), myUnitId: 'un-2', unitOfUser };
  const out = projectVote(vote, U('u-c', 'delegate'), ctx);
  assert.equal(out, null);
});
await Case('projectVote (kín): ẩn userId + signature phiếu người khác, giữ nguyên phiếu mình', () => {
  const vote = {
    meetingId: null, eligibleIds: ['u-a', 'u-b'], createdBy: 'u-tk', secret: true,
    ballots: [
      { userId: 'u-a', optionId: 'o1', castAt: 't1', signature: { serialNumber: 'VN-DEMO-CA:1:aa', hash: 'h', signedAt: 't1', signerName: 'A' } },
      { userId: 'u-b', optionId: 'o2', castAt: 't2' },
    ],
  };
  const ctx = { myMeetingIds: new Set(), myUnitMeetingIds: new Set(), myUnitId: 'un-1', unitOfUser };
  const out = projectVote(vote, U('u-b', 'delegate'), ctx); // u-b đọc, không phải manage/creator
  const mine = out.ballots.find((b) => b.optionId === 'o2');
  const other = out.ballots.find((b) => b.optionId === 'o1');
  assert.equal(mine.userId, 'u-b', 'phiếu của mình giữ userId');
  assert.equal(other.userId, undefined, 'phiếu người khác bị ẩn userId');
  assert.equal(other.signature, undefined, 'phiếu người khác bị ẩn CẢ signature (P0-4)');
  assert.equal(Object.keys(other).sort().join(','), 'castAt,optionId', 'phiếu ẩn danh CHỈ có đúng 2 field');
});

await Case('canReadFeedback: admin thấy tất cả', () => {
  assert.equal(canReadFeedback({ userId: 'u-a', unitId: 'un-1' }, U('u-admin', 'admin'), {}), true);
});
await Case('canReadFeedback: chính chủ thấy của mình', () => {
  assert.equal(canReadFeedback({ userId: 'u-a', unitId: 'un-1' }, U('u-a', 'delegate'), { myUnitId: 'un-9' }), true);
});
await Case('canReadFeedback: unit_admin CÙNG đơn vị thấy', () => {
  assert.equal(canReadFeedback({ userId: 'u-c', unitId: 'un-1' }, U('u-qtdv', 'unit_admin'), { myUnitId: 'un-1' }), true);
});
await Case('canReadFeedback: unit_admin KHÁC đơn vị -> không thấy', () => {
  assert.equal(canReadFeedback({ userId: 'u-c', unitId: 'un-2' }, U('u-qtdv', 'unit_admin'), { myUnitId: 'un-1' }), false);
});
await Case('canReadFeedback: delegate thường không thấy phản hồi người khác', () => {
  assert.equal(canReadFeedback({ userId: 'u-c', unitId: 'un-1' }, U('u-a', 'delegate'), { myUnitId: 'un-1' }), false);
});

// ============================================================
// NHÓM 3 — P0-3: canReviewDocumentAsMeetingMember + guardDocuments (qua guardPatch)
// ============================================================
Group('3-DOC-APPROVAL');

const meetingM2 = { id: 'm2', chairId: 'u-pct', secretaryId: 'u-tk', participants: [{ userId: 'u-khdt' }, { userId: 'u-tc' }] };
const docPending = { id: 'd11', ownerId: 'u-tc', meetingId: 'm2', reviewStatus: 'pending' };

await Case('canReviewDocumentAsMeetingMember: thành phần phiên (không phải owner) + patch hẹp -> true', () => {
  const ok = canReviewDocumentAsMeetingMember(docPending, { reviewStatus: 'approved' }, U('u-khdt', 'delegate'), meetingM2);
  assert.equal(ok, true);
});
await Case('canReviewDocumentAsMeetingMember: OWNER (dù là thành phần phiên) -> false (chống lách tự duyệt)', () => {
  const ok = canReviewDocumentAsMeetingMember(docPending, { reviewStatus: 'approved' }, U('u-tc', 'delegate'), meetingM2);
  assert.equal(ok, false);
});
await Case('canReviewDocumentAsMeetingMember: KHÔNG phải thành phần phiên -> false', () => {
  const ok = canReviewDocumentAsMeetingMember(docPending, { reviewStatus: 'approved' }, U('u-yt', 'delegate'), meetingM2);
  assert.equal(ok, false);
});
await Case('canReviewDocumentAsMeetingMember: patch kèm field KHÁC ngoài reviewStatus/reviewNote -> false (chống lách sửa field khác)', () => {
  const ok = canReviewDocumentAsMeetingMember(docPending, { reviewStatus: 'approved', secret: false }, U('u-khdt', 'delegate'), meetingM2);
  assert.equal(ok, false);
});
await Case('canReviewDocumentAsMeetingMember: meeting null (tài liệu không gắn phiên) -> false', () => {
  const ok = canReviewDocumentAsMeetingMember(docPending, { reviewStatus: 'approved' }, U('u-khdt', 'delegate'), null);
  assert.equal(ok, false);
});
await Case('canReviewDocumentAsMeetingMember: trạng thái hiện tại KHÔNG phải pending -> false', () => {
  const ok = canReviewDocumentAsMeetingMember({ ...docPending, reviewStatus: 'approved' }, { reviewStatus: 'rejected', reviewNote: 'x' }, U('u-khdt', 'delegate'), meetingM2);
  assert.equal(ok, false);
});

await Case('guardPatch(documents): thành phần phiên (u-khdt) duyệt d11 -> reviewedById=u-khdt, không throw', () => {
  const out = guardPatch('documents', docPending, { reviewStatus: 'approved' }, U('u-khdt', 'delegate'), { meeting: meetingM2 });
  assert.equal(out.reviewStatus, 'approved');
  assert.equal(out.reviewedById, 'u-khdt');
});
await Case('guardPatch(documents): owner tự duyệt dù là thành phần chính phiên -> throw 403 (chống hồi quy)', () => {
  assert.throws(
    () => guardPatch('documents', docPending, { reviewStatus: 'approved' }, U('u-tc', 'delegate'), { meeting: meetingM2 }),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(documents): người ngoài phiên duyệt -> throw 403', () => {
  assert.throws(
    () => guardPatch('documents', docPending, { reviewStatus: 'approved' }, U('u-yt', 'delegate'), { meeting: meetingM2 }),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(documents): MANAGE toàn cục vẫn duyệt được như trước (không phá luồng cũ)', () => {
  const out = guardPatch('documents', docPending, { reviewStatus: 'approved' }, U('u-tk', 'secretary'), null);
  assert.equal(out.reviewStatus, 'approved');
});
await Case('guardPatch(documents): reject thiếu reviewNote -> throw 400', () => {
  assert.throws(
    () => guardPatch('documents', docPending, { reviewStatus: 'rejected' }, U('u-khdt', 'delegate'), { meeting: meetingM2 }),
    (e) => e.status === 400,
  );
});

// ============================================================
// NHÓM 4 — P0-4: KÝ SỐ MÔ PHỎNG BALLOT (actions.js)
// ============================================================
Group('4-BALLOT-SIGNATURE');

await Case('SIGN_PIN_RE: đúng 6 chữ số -> match', () => {
  assert.equal(SIGN_PIN_RE.test('123456'), true);
});
await Case('SIGN_PIN_RE: sai định dạng (chữ/thiếu số/dài hơn) -> không match', () => {
  assert.equal(SIGN_PIN_RE.test('abcdef'), false);
  assert.equal(SIGN_PIN_RE.test('12345'), false);
  assert.equal(SIGN_PIN_RE.test('1234567'), false);
  assert.equal(SIGN_PIN_RE.test(''), false);
});

await Case('buildBallotSignature: shape đúng {signedAt,serialNumber,hash,signerName}', () => {
  const sig = buildBallotSignature({ voteId: 'v1', userId: 'u-a', optionId: 'o1', comment: 'ok', signerName: 'Nguyễn Văn A' });
  assert.equal(typeof sig.signedAt, 'string');
  assert.equal(Number.isNaN(Date.parse(sig.signedAt)), false, 'signedAt là ISO date hợp lệ');
  assert.match(sig.serialNumber, /^VN-DEMO-CA:\d{4}:[0-9a-f]{6}$/, 'serialNumber đúng khuôn dạng');
  assert.match(sig.hash, /^[0-9a-f]{64}$/, 'hash là SHA-256 hex 64 ký tự');
  assert.equal(sig.signerName, 'Nguyễn Văn A', 'signerName giữ nguyên tiếng Việt có dấu (Unicode)');
});
await Case('buildBallotSignature: hash ĐÚNG công thức sha256(voteId|userId|optionId|comment), tính TẠI SERVER', () => {
  const args = { voteId: 'v9', userId: 'u-9', optionId: 'o9', comment: 'ý kiến của tôi', signerName: 'X' };
  const sig = buildBallotSignature(args);
  const expected = sha256hex(`${args.voteId}|${args.userId}|${args.optionId}|${args.comment}`);
  assert.equal(sig.hash, expected);
});
await Case('buildBallotSignature: comment undefined -> hash dùng chuỗi rỗng (không "undefined")', () => {
  const sig = buildBallotSignature({ voteId: 'v1', userId: 'u-a', optionId: 'o1', comment: undefined, signerName: 'X' });
  const expected = sha256hex('v1|u-a|o1|');
  assert.equal(sig.hash, expected);
});
await Case('buildBallotSignature: 2 lần gọi cùng input -> hash GIỐNG NHAU (xác định), serialNumber KHÁC NHAU (ngẫu nhiên, không trùng lặp bên ngoài)', () => {
  const args = { voteId: 'v1', userId: 'u-a', optionId: 'o1', comment: 'x', signerName: 'X' };
  const s1 = buildBallotSignature(args);
  const s2 = buildBallotSignature(args);
  assert.equal(s1.hash, s2.hash, 'hash xác định (deterministic) theo nội dung');
  assert.notEqual(s1.serialNumber, s2.serialNumber, 'serialNumber sinh ngẫu nhiên mỗi lần ký');
});

// ============================================================
// NHÓM 5 — P1-5: VOTE DRAFT + trackerUserId (guard.js validatePatch)
// ============================================================
Group('5-VOTE-DRAFT');

await Case("validatePatch(votes): status='draft' hợp lệ (không throw)", () => {
  assert.doesNotThrow(() => validatePatch('votes', { status: 'draft' }));
});
await Case('validatePatch(votes): status rác -> throw 400', () => {
  assert.throws(() => validatePatch('votes', { status: 'huy-hoang-rac' }), (e) => e.status === 400);
});
await Case("validatePatch(votes): trackerUserId chuỗi hợp lệ -> không throw", () => {
  assert.doesNotThrow(() => validatePatch('votes', { trackerUserId: 'u-tk' }));
});
await Case('validatePatch(votes): trackerUserId sai kiểu (số) -> throw 400', () => {
  assert.throws(() => validatePatch('votes', { trackerUserId: 12345 }), (e) => e.status === 400);
});

await Case("guardPatch(votes): non-MANAGE PATCH trực tiếp -> throw 403 (kể cả status='draft', giữ hành vi cũ)", () => {
  assert.throws(() => guardPatch('votes', {}, { status: 'draft' }, U('u-x', 'delegate')), (e) => e.status === 403);
});
await Case('guardPatch(votes): MANAGE PATCH nội dung khác status/ballots vẫn qua được (giữ hành vi cũ)', () => {
  const out = guardPatch('votes', {}, { title: 'Đổi tên biểu quyết' }, U('u-tk', 'secretary'));
  assert.equal(out.title, 'Đổi tên biểu quyết');
  assert.equal(out.status, undefined, 'status vẫn bị guardVotes xóa dù MANAGE (chỉ đổi qua /actions)');
});

// ============================================================
// NHÓM 6 — P1-6: FEEDBACKS (guardFeedbacks qua guardPatch + validatePatch)
// ============================================================
Group('6-FEEDBACKS');

const fbExisting = { id: 'fb-1', userId: 'u-a', unitId: 'un-1', category: 'bug', content: 'lỗi X', status: 'new' };

await Case('guardPatch(feedbacks): người KHÔNG phải admin đổi status -> throw 403', () => {
  assert.throws(
    () => guardPatch('feedbacks', fbExisting, { status: 'resolved' }, U('u-a', 'delegate')),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(feedbacks): NGƯỜI KHÁC (không phải chủ, không phải admin) sửa content -> throw 403', () => {
  assert.throws(
    () => guardPatch('feedbacks', fbExisting, { content: 'sửa hộ' }, U('u-b', 'delegate')),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(feedbacks): CHÍNH CHỦ sửa content của mình -> qua được, userId/unitId bị xóa khỏi patch (bất biến)', () => {
  const out = guardPatch('feedbacks', fbExisting, { content: 'đã thử lại', userId: 'u-hack', unitId: 'un-hack' }, U('u-a', 'delegate'));
  assert.equal(out.content, 'đã thử lại');
  assert.equal(out.userId, undefined, 'userId bị xóa khỏi patch (server ép bất biến)');
  assert.equal(out.unitId, undefined, 'unitId bị xóa khỏi patch');
});
await Case('guardPatch(feedbacks): admin đổi status/response/handledBy -> qua được, handledBy ÉP = chính admin', () => {
  const out = guardPatch('feedbacks', fbExisting, { status: 'processing', response: 'đang xử lý', handledBy: 'u-nguoi-khac' }, U('u-admin', 'admin'));
  assert.equal(out.status, 'processing');
  assert.equal(out.handledBy, 'u-admin', 'server ép handledBy = chính admin đang xử lý, không tin client');
});
// Vá QA 18/07 — unit_admin xử lý phản hồi TRONG ĐƠN VỊ MÌNH (HSMT "nhận & phân phối yêu cầu")
await Case('guardPatch(feedbacks): unit_admin CÙNG đơn vị (extra.actorUnitId khớp) đổi status -> qua được, handledBy ÉP = chính mình', () => {
  const out = guardPatch('feedbacks', fbExisting, { status: 'resolved', handledBy: 'u-ai-do' }, U('u-qtdv', 'unit_admin'), { actorUnitId: 'un-1' });
  assert.equal(out.status, 'resolved');
  assert.equal(out.handledBy, 'u-qtdv', 'server ép handledBy = chính người xử lý');
});
await Case('guardPatch(feedbacks): unit_admin KHÁC đơn vị -> throw 403', () => {
  assert.throws(
    () => guardPatch('feedbacks', fbExisting, { status: 'resolved' }, U('u-qtdv2', 'unit_admin'), { actorUnitId: 'un-2' }),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(feedbacks): unit_admin KHÔNG có actorUnitId (thiếu ngữ cảnh) -> throw 403 (an toàn mặc định)', () => {
  assert.throws(
    () => guardPatch('feedbacks', fbExisting, { status: 'resolved' }, U('u-qtdv', 'unit_admin')),
    (e) => e.status === 403,
  );
});

await Case("validatePatch(feedbacks): category hợp lệ -> không throw; rác -> throw 400", () => {
  assert.doesNotThrow(() => validatePatch('feedbacks', { category: 'feature' }));
  assert.throws(() => validatePatch('feedbacks', { category: 'khong-ton-tai' }), (e) => e.status === 400);
});
await Case('validatePatch(feedbacks): content rỗng -> throw 400', () => {
  assert.throws(() => validatePatch('feedbacks', { content: '   ' }), (e) => e.status === 400);
});
await Case('db.js COLLECTIONS: có đăng ký "feedbacks" -> "c_feedbacks"', () => {
  assert.equal(COLLECTIONS.feedbacks, 'c_feedbacks');
});
// Vá QA 18/07 (P0 tester) — danh mục LOẠI TÀI LIỆU (HSMT mục 8) phải qua được validate
await Case("validatePatch(catalogs): type='docType' (danh mục loại tài liệu — HSMT mục 8) -> hợp lệ", () => {
  assert.doesNotThrow(() => validatePatch('catalogs', { type: 'docType', name: 'Công văn' }));
});
await Case('validatePatch(catalogs): type rác -> throw 400', () => {
  assert.throws(() => validatePatch('catalogs', { type: 'docKind-xyz', name: 'x' }), (e) => e.status === 400);
});

// ============================================================
// NHÓM 7 — P1-7: WHITELIST ĐỊNH DẠNG TỆP (TT 39/2017/TT-BTTTT)
// ============================================================
Group('7-FILE-WHITELIST');

await Case('validatePatch(documents): dataUrl + đuôi .exe -> throw 400 nêu rõ whitelist', () => {
  assert.throws(
    () => validatePatch('documents', { name: 'virus.exe', dataUrl: 'data:x;base64,AA' }),
    (e) => e.status === 400 && /Định dạng tệp không hợp lệ/.test(e.message) && /pdf/.test(e.message),
  );
});
await Case('validatePatch(documents): dataUrl + đuôi .pdf -> không throw', () => {
  assert.doesNotThrow(() => validatePatch('documents', { name: 'bao-cao.pdf', dataUrl: 'data:x;base64,AA' }));
});
await Case('validatePatch(documents): TOÀN BỘ 22 đuôi hợp lệ đều qua được', () => {
  const exts = ['pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp', 'txt', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp', 'zip', 'rar'];
  for (const ext of exts) {
    assert.doesNotThrow(() => validatePatch('documents', { name: `f.${ext}`, dataUrl: 'data:x;base64,AA' }), `đuôi ${ext} phải hợp lệ`);
  }
});
await Case('validatePatch(documents): KHÔNG có dataUrl (chỉ content soạn trực tiếp) -> KHÔNG áp whitelist', () => {
  assert.doesNotThrow(() => validatePatch('documents', { name: 'khong-co-duoi', content: 'nội dung' }));
});
await Case('validatePatch(documents): PATCH chỉ đổi name (không kèm dataUrl) trên bản ghi ĐANG CÓ file -> vẫn kiểm theo bản ghi hiệu lực', () => {
  const existing = { name: 'cu.pdf', dataUrl: 'data:x;base64,AA' };
  assert.throws(
    () => validatePatch('documents', { name: 'doi-ten.exe' }, existing),
    (e) => e.status === 400,
  );
  assert.doesNotThrow(() => validatePatch('documents', { name: 'doi-ten-khac.docx' }, existing));
});
await Case('validatePatch(documents): PATCH đổi dataUrl (kèm hoặc không kèm name) dùng name CŨ của existing để suy đuôi', () => {
  const existing = { name: 'bao-cao.pdf', dataUrl: 'data:old;base64,AA' };
  // patch chỉ đổi nội dung dataUrl, KHÔNG đổi name -> effectiveName vẫn là "bao-cao.pdf" (hợp lệ)
  assert.doesNotThrow(() => validatePatch('documents', { dataUrl: 'data:new;base64,BB' }, existing));
});

// ============================================================
// NHÓM 7B — vá 2026-07-20 (rà soát mục 14 "Xóa thư mục"): documents.folder chấp nhận
// 'string|null' — PATCH { folder: null } là cách round-trip đúng qua JSON để "gỡ nhãn thư
// mục" ở chế độ máy chủ (client gửi { folder: undefined } sẽ bị JSON.stringify LOẠI khỏi
// body trước khi tới server — server không thấy field, giữ nguyên giá trị cũ, "xóa thư mục"
// KHÔNG có tác dụng thật). Xem removeFolder/setDocFolder (documentService.ts) +
// DocFile.folder (types.ts) — cùng đợt vá.
// ============================================================
await Case('validatePatch(documents): folder=null (gỡ nhãn thư mục, mục 14) -> không throw', () => {
  assert.doesNotThrow(() => validatePatch('documents', { folder: null }));
});
await Case('validatePatch(documents): folder chuỗi hợp lệ -> không throw', () => {
  assert.doesNotThrow(() => validatePatch('documents', { folder: 'Chuẩn bị họp tháng 8' }));
});
await Case('validatePatch(documents): folder sai kiểu (số) -> throw 400', () => {
  assert.throws(
    () => validatePatch('documents', { folder: 123 }),
    (e) => e.status === 400 && /folder/.test(e.message),
  );
});
await Case('validatePatch(documents): folder=[] (mảng, không phải null/string) -> throw 400', () => {
  assert.throws(() => validatePatch('documents', { folder: [] }), (e) => e.status === 400);
});

// ============================================================
// NHÓM 8 — P1-8: UNICODE ROUND-TRIP (tiếng Việt NFC/NFD + emoji)
// ============================================================
Group('8-UNICODE');

await Case('JSON round-trip: tiếng Việt NFC + emoji giữ nguyên qua JSON.stringify/parse', () => {
  const s = 'Xin chào! Ứng dụng chạy ổn định, cảm ơn đội phát triển. 🎉👍🇻🇳';
  const roundtrip = JSON.parse(JSON.stringify({ content: s })).content;
  assert.equal(roundtrip, s);
  assert.equal(roundtrip.normalize('NFC'), s.normalize('NFC'));
});
await Case('JSON round-trip: chuỗi NFD (tổ hợp dấu, CHƯA chuẩn hóa NFC) giữ nguyên byte-for-byte', () => {
  const nfc = 'Cuộc họp không giấy tờ — kiểm thử ký tự tổ hợp';
  const nfd = nfc.normalize('NFD');
  assert.notEqual(nfd, nfc, 'tiền điều kiện: NFD phải khác NFC (nếu không test vô nghĩa)');
  const roundtrip = JSON.parse(JSON.stringify({ content: nfd })).content;
  assert.equal(roundtrip, nfd, 'NFD round-trip NGUYÊN VẸN qua JSON — không tự chuẩn hóa về NFC');
  assert.equal(roundtrip.length, nfd.length, 'độ dài code unit giữ nguyên');
});
await Case('validatePatch(feedbacks): nội dung tiếng Việt + emoji qua được nguyên vẹn (không mutate)', () => {
  const content = 'Không mở được video 📹 trên điện thoại — lỗi ở bước xác thực OTP.';
  const body = { content };
  validatePatch('feedbacks', body); // không throw
  assert.equal(body.content, content, 'validatePatch không làm thay đổi nội dung Unicode');
});
await Case('guardPatch(feedbacks): nội dung tiếng Việt có dấu round-trip nguyên vẹn qua patch đã làm sạch', () => {
  const content = 'Đã thử lại trên Chrome — vẫn không tải được tài liệu 📄.';
  const out = guardPatch('feedbacks', fbExisting, { content }, U('u-a', 'delegate'));
  assert.equal(out.content, content);
});
await Case('buildBallotSignature: signerName tiếng Việt có dấu tổ hợp (NFD) + emoji giữ nguyên', () => {
  const nfdName = 'Nguyễn Thị Hà'.normalize('NFD') + ' 🖋️';
  const sig = buildBallotSignature({ voteId: 'v1', userId: 'u-a', optionId: 'o1', comment: '', signerName: nfdName });
  assert.equal(sig.signerName, nfdName);
});

// ============================================================
// NHÓM 9 — P2-1 (QA 18/07, tester-qa.md mục 3.5): chairCtl (FE, id-match theo
// chairId/secretaryId của CHÍNH phiên) vs MANAGE (BE, role-match toàn cục) cho
// PATCH conclusions/agenda/minutes — người được GÁN làm chủ trì/thư ký của một
// phiên cụ thể (dù role tài khoản là 'delegate', không phải 'chairman') phải
// ghi được kết luận/chương trình/dự thảo biên bản của CHÍNH phiên đó; các field
// khóa cứng (status, checkedInAt, chữ ký/khóa biên bản, field khác) vẫn bất biến.
// ============================================================
Group('9-GUARD-CHAIR-VS-MANAGE');

const meetingChairedByDelegate = {
  id: 'm-chair-test', chairId: 'u-delegate-chair', secretaryId: 'u-tk',
  status: 'live', participants: [{ userId: 'u-delegate-chair', checkedInAt: 't0' }],
  minutes: { content: 'cũ', signatures: [], locked: false },
};

await Case('guardPatch(meetings): delegate được GÁN làm chairId của CHÍNH phiên -> sửa conclusions được (P2-1)', () => {
  const out = guardPatch(
    'meetings', meetingChairedByDelegate,
    { conclusions: [{ id: 'c1', content: 'Kết luận mới', createdAt: 't1' }] },
    U('u-delegate-chair', 'delegate'),
  );
  assert.deepEqual(out.conclusions, [{ id: 'c1', content: 'Kết luận mới', createdAt: 't1' }], 'conclusions KHÔNG bị xóa khỏi patch');
});
await Case('guardPatch(meetings): delegate được GÁN làm secretaryId của CHÍNH phiên -> sửa agenda được (P2-1)', () => {
  const meeting = { ...meetingChairedByDelegate, chairId: 'u-ct-khac', secretaryId: 'u-delegate-secretary' };
  const out = guardPatch(
    'meetings', meeting,
    { agenda: [{ id: 'a1', order: 1, title: 'Mục mới' }] },
    U('u-delegate-secretary', 'delegate'),
  );
  assert.deepEqual(out.agenda, [{ id: 'a1', order: 1, title: 'Mục mới' }], 'agenda KHÔNG bị xóa khỏi patch');
});
await Case('guardPatch(meetings): delegate chairId của CHÍNH phiên -> sửa minutes (dự thảo, CHƯA khóa) được (P2-1)', () => {
  const out = guardPatch(
    'meetings', meetingChairedByDelegate,
    { minutes: { content: 'Dự thảo mới' } },
    U('u-delegate-chair', 'delegate'),
  );
  assert.equal(out.minutes.content, 'Dự thảo mới');
  assert.deepEqual(out.minutes.signatures, [], 'signatures vẫn lấy từ existing (không tin client)');
  assert.equal(out.minutes.locked, false);
});
await Case('guardPatch(meetings): delegate KHÔNG liên quan phiên (không phải chairId/secretaryId phiên này) -> conclusions VẪN bị xóa (silent no-op, giữ hành vi cũ)', () => {
  const out = guardPatch(
    'meetings', meetingChairedByDelegate,
    { conclusions: [{ id: 'c-lech', content: 'Không được phép', createdAt: 't1' }] },
    U('u-delegate-khac', 'delegate'),
  );
  assert.equal(out.conclusions, undefined, 'delegate thường (không id-match) không sửa được conclusions');
});
await Case('guardPatch(meetings): delegate chairId phiên NÀY nhưng gửi title/room kèm theo -> title/room vẫn bị xóa (KHÔNG mở field khác)', () => {
  const out = guardPatch(
    'meetings', meetingChairedByDelegate,
    { conclusions: [{ id: 'c2', content: 'x', createdAt: 't1' }], title: 'Đổi tên phiên', roomId: 'room-khac', chairId: 'u-hack' },
    U('u-delegate-chair', 'delegate'),
  );
  assert.notEqual(out.conclusions, undefined, 'conclusions vẫn qua');
  assert.equal(out.title, undefined, 'title KHÔNG được mở (chỉ mở conclusions/agenda/minutes)');
  assert.equal(out.roomId, undefined, 'roomId KHÔNG được mở');
  assert.equal(out.chairId, undefined, 'chairId KHÔNG được mở (không tự đổi chủ trì)');
});
await Case('guardPatch(meetings): delegate chairId phiên này gửi kèm status -> status vẫn bị xóa (chỉ qua /actions)', () => {
  const out = guardPatch(
    'meetings', meetingChairedByDelegate,
    { conclusions: [{ id: 'c3', content: 'x', createdAt: 't1' }], status: 'finished' },
    U('u-delegate-chair', 'delegate'),
  );
  assert.equal(out.status, undefined, 'status vẫn khóa cứng, kể cả với chairId id-match');
});
await Case('guardPatch(meetings): delegate chairId phiên này gửi kèm seatAssignments -> throw 403 (field khóa cứng khác, không âm thầm bỏ qua)', () => {
  assert.throws(
    () => guardPatch('meetings', meetingChairedByDelegate, { seatAssignments: { 'seat-1': 'u-x' } }, U('u-delegate-chair', 'delegate')),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(meetings): minutes đã KHÓA (locked=true) -> id-match chairId cũng KHÔNG sửa được (bất biến, giữ hành vi cũ)', () => {
  const lockedMeeting = { ...meetingChairedByDelegate, minutes: { content: 'đã ký', signatures: [{ userId: 'u-x' }], locked: true } };
  const out = guardPatch('meetings', lockedMeeting, { minutes: { content: 'sửa lén' } }, U('u-delegate-chair', 'delegate'));
  assert.equal(out.minutes, undefined, 'minutes đã khóa: patch bị xóa hoàn toàn, kể cả với chairId id-match');
});
// Vá 18/07 — ca "khoảng giữa": có 1 chữ ký nhưng CHƯA đủ 2 (locked=false) vẫn phải bất biến nội dung
await Case('guardPatch(meetings): minutes có 1 chữ ký (locked=false) -> KHÔNG ghi đè content được (chair id-match)', () => {
  const oneSig = { ...meetingChairedByDelegate, minutes: { content: 'đã ký 1', signatures: [{ userId: 'u-x' }], locked: false } };
  const out = guardPatch('meetings', oneSig, { minutes: { content: 'sửa lén giữa chừng' } }, U('u-delegate-chair', 'delegate'));
  assert.equal(out.minutes, undefined, 'có ≥1 chữ ký: patch minutes bị xóa dù chưa locked (chống ghi đè nội dung đã ký)');
});
await Case('guardPatch(meetings): minutes có 1 chữ ký -> MANAGE role cũng KHÔNG ghi đè content', () => {
  const oneSig = { id: 'm-sig1', chairId: 'u-a', secretaryId: 'u-b', status: 'ended', participants: [], minutes: { content: 'đã ký 1', signatures: [{ userId: 'u-a' }], locked: false } };
  const out = guardPatch('meetings', oneSig, { minutes: { content: 'admin sửa lén' } }, U('u-admin', 'admin'));
  assert.equal(out.minutes, undefined, 'có ≥1 chữ ký: admin/MANAGE cũng không ghi đè nội dung biên bản qua CRUD chung');
});
await Case('guardPatch(meetings): minutes CHƯA có chữ ký nào (dự thảo trắng) -> vẫn sửa được (không hồi quy)', () => {
  const draft = { ...meetingChairedByDelegate, minutes: { content: 'nháp', signatures: [], locked: false } };
  const out = guardPatch('meetings', draft, { minutes: { content: 'sửa nháp hợp lệ' } }, U('u-delegate-chair', 'delegate'));
  assert.equal(out.minutes.content, 'sửa nháp hợp lệ', 'chưa ký: vẫn sửa dự thảo bình thường');
});
await Case('guardPatch(meetings): MANAGE (role=chairman thật, không id-match phiên NÀY) vẫn sửa được conclusions như cũ (không hồi quy)', () => {
  const meeting = { id: 'm-other', chairId: 'u-ct-khac-nua', secretaryId: 'u-tk-khac', status: 'live', participants: [] };
  const out = guardPatch('meetings', meeting, { conclusions: [{ id: 'c-manage', content: 'x', createdAt: 't1' }] }, U('u-chairman-role', 'chairman'));
  assert.notEqual(out.conclusions, undefined, 'MANAGE role sửa conclusions của BẤT KỲ phiên nào, đúng hành vi cũ');
});

// ============================================================
// NHÓM 10 — KHUYẾN NGHỊ 1 (2026-07-18, chốt code chéo): unit_admin SỬA/XÓA phiên
// THUỘC ĐƠN VỊ MÌNH. ACL.meetings.remove + guardMeetings(extra.actorUnitId/meetingUnitId).
// enforceMeetingWrite() (index.js) cần DB thật (getExisting) nên KHÔNG test được ở đây
// (hàm không thuần) — phủ đầy đủ ở ECabinet.Tests (TestHost, level HTTP) NHÓM 8-MULTITENANT.
// ============================================================
Group('10-UNIT-ADMIN-MEETING-WRITE');

await Case('ACL.meetings.remove: unit_admin ĐƯỢC xóa (Khuyến nghị 1 — ACL lỏng, siết sâu ở enforceMeetingWrite)', () => {
  assert.equal(allowed(ACL.meetings.remove, { user: U('u-qtdv', 'unit_admin') }, {}, null), true);
});
await Case('ACL.meetings.remove: delegate thường VẪN KHÔNG được xóa (giữ hành vi cũ)', () => {
  assert.equal(allowed(ACL.meetings.remove, { user: U('u-x', 'delegate') }, {}, null), false);
});
await Case('ACL.meetings.remove: MANAGE (admin/secretary/chairman) vẫn xóa được như trước (không hồi quy)', () => {
  for (const role of MANAGE) {
    assert.equal(allowed(ACL.meetings.remove, { user: U('u-x', role) }, {}, null), true, `role=${role}`);
  }
});

const meetingQtdvOwn = {
  id: 'm-unit-admin-own', chairId: 'u-khdt-chair', secretaryId: 'u-khdt-sec', status: 'draft',
  participants: [], conclusions: [], minutes: null,
};

await Case('guardPatch(meetings): unit_admin CÙNG đơn vị phiên (actorUnitId===meetingUnitId) sửa title/roomId/agenda -> qua được như MANAGE (Khuyến nghị 1)', () => {
  const out = guardPatch(
    'meetings', meetingQtdvOwn,
    { title: 'Đổi tên phiên', roomId: 'r2', agenda: [{ id: 'a1', order: 1, title: 'Mục mới' }] },
    U('u-qtdv', 'unit_admin'),
    { actorUnitId: 'un-khdt', meetingUnitId: 'un-khdt' },
  );
  assert.equal(out.title, 'Đổi tên phiên', 'unit_admin cùng đơn vị phiên sửa được title (KHÔNG bị xóa như đại biểu thường)');
  assert.equal(out.roomId, 'r2', 'sửa được roomId');
  assert.deepEqual(out.agenda, [{ id: 'a1', order: 1, title: 'Mục mới' }], 'sửa được agenda');
});
await Case('guardPatch(meetings): unit_admin KHÁC đơn vị phiên (actorUnitId!==meetingUnitId) -> title/roomId bị xóa sạch như đại biểu thường (defense-in-depth, độc lập với enforceMeetingWrite)', () => {
  const out = guardPatch(
    'meetings', meetingQtdvOwn,
    { title: 'Đổi tên phiên', roomId: 'r2' },
    U('u-qtdv', 'unit_admin'),
    { actorUnitId: 'un-khac', meetingUnitId: 'un-khdt' },
  );
  assert.equal(out.title, undefined, 'unit_admin KHÁC đơn vị: title bị xóa (không được coi như MANAGE)');
  assert.equal(out.roomId, undefined, 'roomId bị xóa');
});
await Case('guardPatch(meetings): unit_admin KHÔNG có extra (thiếu actorUnitId/meetingUnitId) -> coi như đại biểu thường, field bị xóa (an toàn mặc định)', () => {
  const out = guardPatch('meetings', meetingQtdvOwn, { title: 'Lén sửa' }, U('u-qtdv', 'unit_admin'));
  assert.equal(out.title, undefined, 'thiếu ngữ cảnh đơn vị -> KHÔNG coi như MANAGE (an toàn mặc định)');
});
await Case('guardPatch(meetings): unit_admin CÙNG đơn vị phiên vẫn KHÔNG mở được questionSession (field điều hành trực tiếp tại phòng họp, CHỦ Ý không gộp isUnitAdminHere)', () => {
  assert.throws(
    () => guardPatch(
      'meetings', meetingQtdvOwn, { questionSession: 'open' }, U('u-qtdv', 'unit_admin'),
      { actorUnitId: 'un-khdt', meetingUnitId: 'un-khdt' },
    ),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(meetings): unit_admin CÙNG đơn vị phiên vẫn KHÔNG mở được seatAssignments (field điều hành trực tiếp)', () => {
  assert.throws(
    () => guardPatch(
      'meetings', meetingQtdvOwn, { seatAssignments: { '1-1': 'u-x' } }, U('u-qtdv', 'unit_admin'),
      { actorUnitId: 'un-khdt', meetingUnitId: 'un-khdt' },
    ),
    (e) => e.status === 403,
  );
});
await Case('guardPatch(meetings): unit_admin CÙNG đơn vị phiên -> minutes có ≥1 chữ ký VẪN bất biến (khóa cứng không đổi bất kể isUnitAdminHere)', () => {
  const signed = { ...meetingQtdvOwn, minutes: { content: 'đã ký 1', signatures: [{ userId: 'u-x' }], locked: false } };
  const out = guardPatch(
    'meetings', signed, { minutes: { content: 'sửa lén' } }, U('u-qtdv', 'unit_admin'),
    { actorUnitId: 'un-khdt', meetingUnitId: 'un-khdt' },
  );
  assert.equal(out.minutes, undefined, 'có ≥1 chữ ký: unit_admin cùng đơn vị cũng KHÔNG ghi đè được nội dung biên bản');
});
await Case('guardPatch(meetings): unit_admin CÙNG đơn vị phiên -> participants dùng keepServerCheckins (giống MANAGE, không bị bó hẹp delegateOwnRowOnly)', () => {
  const meeting = {
    ...meetingQtdvOwn,
    participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'pending', checkedInAt: 't-server' }],
  };
  const out = guardPatch(
    'meetings', meeting,
    { participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'accepted', checkedInAt: 'gia-mao' }] },
    U('u-qtdv', 'unit_admin'),
    { actorUnitId: 'un-khdt', meetingUnitId: 'un-khdt' },
  );
  assert.equal(out.participants[0].attendStatus, 'accepted', 'unit_admin cùng đơn vị sửa được attendStatus của MỌI dòng (như MANAGE)');
  assert.equal(out.participants[0].checkedInAt, 't-server', 'checkedInAt vẫn giữ từ server (keepServerCheckins), không tin client');
});

// ------------------------------------------------------------
// Vá 2026-07-20 (rà soát mục 20 "Thêm mới, cập nhật, xóa thông tin người tham gia họp") —
// meetingService.addParticipant/removeParticipant/updateParticipant (FE, demo+REST) ghi
// atomic qua PATCH { participants: [...] }, đi qua guardMeetings CHUNG với đường
// "Chỉnh sửa phiên họp" cũ (buildParticipants). Không nới guard nào thêm — 3 ca dưới XÁC
// NHẬN guard hiện có đã đủ rộng cho vai quản lý THÊM/XÓA (không chỉ SỬA) 1 dòng participant,
// tránh hồi quy nếu guardMeetings đổi sau này.
// ------------------------------------------------------------
await Case('guardPatch(meetings): MANAGE THÊM 1 participant mới (mảng dài hơn existing) -> qua được, không bị chặn nhầm (mục 20)', () => {
  const meeting = {
    ...meetingQtdvOwn,
    chairId: 'u-chair', secretaryId: 'u-sec',
    participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null }],
  };
  const out = guardPatch(
    'meetings', meeting,
    {
      participants: [
        { userId: 'u-a', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null },
        { userId: 'u-new', meetingRole: 'guest', attendStatus: 'pending', checkedInAt: null },
      ],
    },
    U('u-chair', 'chairman'),
  );
  assert.equal(out.participants.length, 2, 'chủ trì (MANAGE) THÊM được người mới vào participants');
  assert.equal(out.participants[1].userId, 'u-new');
  assert.equal(out.participants[1].meetingRole, 'guest');
  assert.equal(out.participants[1].checkedInAt, null, 'người MỚI không có checkedInAt cũ để giữ -> null (keepServerCheckins), không lấy giá trị giả từ client');
});
await Case('guardPatch(meetings): MANAGE XÓA 1 participant (mảng ngắn hơn existing) -> qua được, không bị chặn nhầm (mục 20)', () => {
  const meeting = {
    ...meetingQtdvOwn,
    chairId: 'u-chair', secretaryId: 'u-sec',
    participants: [
      { userId: 'u-a', meetingRole: 'member', attendStatus: 'accepted', checkedInAt: null },
      { userId: 'u-b', meetingRole: 'guest', attendStatus: 'pending', checkedInAt: null },
    ],
  };
  const out = guardPatch(
    'meetings', meeting,
    { participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'accepted', checkedInAt: null }] },
    U('u-chair', 'chairman'),
  );
  assert.equal(out.participants.length, 1, 'chủ trì (MANAGE) XÓA được 1 người khỏi participants (mảng ngắn hơn vẫn qua)');
  assert.equal(out.participants[0].userId, 'u-a');
});
await Case('guardPatch(meetings): unit_admin CÙNG đơn vị phiên THÊM/XÓA participant -> qua được như MANAGE (mục 20, không bị bó hẹp delegateOwnRowOnly)', () => {
  const meeting = { ...meetingQtdvOwn, participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null }] };
  const outAdd = guardPatch(
    'meetings', meeting,
    { participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null }, { userId: 'u-new', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null }] },
    U('u-qtdv', 'unit_admin'), { actorUnitId: 'un-khdt', meetingUnitId: 'un-khdt' },
  );
  assert.equal(outAdd.participants.length, 2, 'unit_admin cùng đơn vị THÊM được người tham gia');
  const outRemove = guardPatch(
    'meetings', meeting, { participants: [] },
    U('u-qtdv', 'unit_admin'), { actorUnitId: 'un-khdt', meetingUnitId: 'un-khdt' },
  );
  assert.equal(outRemove.participants.length, 0, 'unit_admin cùng đơn vị XÓA được người tham gia (mảng rỗng vẫn qua)');
});
await Case('guardPatch(meetings): unit_admin KHÁC đơn vị phiên cố THÊM participant lạ -> KHÔNG lọt qua (delegateOwnRowOnly chỉ giữ dòng CŨ + dòng ủy quyền hợp lệ, không phải "thêm tự do" như MANAGE/unit_admin-cùng-đơn-vị)', () => {
  const meeting = { ...meetingQtdvOwn, participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null }] };
  const out = guardPatch(
    'meetings', meeting,
    { participants: [{ userId: 'u-a', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null }, { userId: 'u-hack', meetingRole: 'member', attendStatus: 'pending', checkedInAt: null }] },
    U('u-qtdv', 'unit_admin'), { actorUnitId: 'un-khac', meetingUnitId: 'un-khdt' },
  );
  // u-qtdv KHÔNG có dòng trong existing.participants -> delegateOwnRowOnly không coi đây là
  // "ủy quyền hợp lệ" nào -> u-hack KHÔNG được thêm; participants vẫn CÓ MẶT trong patch
  // (không bị xóa hẳn field) nhưng giữ NGUYÊN nội dung existing (1 dòng u-a, không phải 2).
  assert.equal(out.participants.length, 1, 'unit_admin KHÁC đơn vị: KHÔNG thêm được người lạ vào participants (chỉ giữ nguyên existing)');
  assert.equal(out.participants[0].userId, 'u-a');
});

// ============================================================
// NHÓM 11 — TÁCH FILE OBJECT STORAGE (S3/MinIO): SigV4 + round-trip + tương thích ngược
// (GĐ3 — tách nội dung tệp base64 khỏi CSDL). KHÔNG cần S3 thật: SigV4 kiểm bằng
// TEST VECTOR CHÍNH THỨC của AWS; tách/dựng kiểm bằng blobStore in-memory giả.
// ============================================================
Group('11-BLOB-S3');

// ---- Store in-memory giả: parity hợp đồng blobStore (configured/put/get/delete) ----
function makeMemStore(on = true) {
  const map = new Map();
  return {
    _map: map,
    configured: () => on,
    async put(key, bytes, _ct) { map.set(key, Buffer.from(bytes)); },
    async get(key) { if (!map.has(key)) throw new Error('404'); return map.get(key); },
    async delete(key) { map.delete(key); },
  };
}

// creds/region/service/date cố định của aws-sig-v4-test-suite (get-vanilla)
const SV4 = {
  accessKey: 'AKIDEXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1', service: 'service',
  date: new Date(Date.UTC(2015, 7, 30, 12, 36, 0)),
};
const EMPTY_HASH = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');

await Case('SigV4 test-vector AWS get-vanilla: canonicalRequest + stringToSign + Authorization khớp BYTE', () => {
  const r = signRequestV4({
    method: 'GET', canonicalUri: '/', query: {},
    headers: { host: 'example.amazonaws.com', 'x-amz-date': '20150830T123600Z' },
    payloadHash: EMPTY_HASH, ...SV4,
  });
  assert.equal(r.canonicalRequest,
    'GET\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\n'
    + 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'canonicalRequest phải khớp vector');
  assert.equal(r.stringToSign,
    'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/service/aws4_request\n'
    + 'bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63',
    'stringToSign phải khớp vector');
  assert.equal(r.signature, '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31', 'signature khớp vector');
  assert.equal(r.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, '
    + 'SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    'Authorization header khớp vector');
});

await Case('SigV4 test-vector AWS get-vanilla-query-order-key-case: sort query theo key đã encode', () => {
  const r = signRequestV4({
    method: 'GET', canonicalUri: '/', query: { Param2: 'value2', Param1: 'value1' },
    headers: { host: 'example.amazonaws.com', 'x-amz-date': '20150830T123600Z' },
    payloadHash: EMPTY_HASH, ...SV4,
  });
  assert.equal(r.signature, 'b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500', 'signature vector query khớp');
});

await Case('uriEncode RFC3986: space=%20, ~ giữ nguyên, / tùy chọn, UTF-8 đúng byte', () => {
  assert.equal(uriEncode(' '), '%20');
  assert.equal(uriEncode('~'), '~');
  assert.equal(uriEncode('a/b', false), 'a/b', 'giữ / khi encodeSlash=false');
  assert.equal(uriEncode('a/b', true), 'a%2Fb', 'encode / khi encodeSlash=true');
  assert.equal(uriEncode('ü'), '%C3%BC', 'UTF-8 2 byte');
  assert.equal(uriEncode('Tài liệu'), 'T%C3%A0i%20li%E1%BB%87u', 'tiếng Việt đúng byte');
});

await Case('isDataUri: nhận diện data URI base64; loại trừ chuỗi thường / data:text không base64', () => {
  assert.equal(isDataUri('data:application/pdf;base64,JVBERi0='), true);
  assert.equal(isDataUri('data:text/plain,hello'), false, 'không base64 -> bỏ qua (đây là content thuần)');
  assert.equal(isDataUri('nội dung văn bản'), false);
  assert.equal(isDataUri(undefined), false);
});

await Case('decode/encode data URI: round-trip BYTES khớp + mime giữ đúng', () => {
  const bytes = crypto.randomBytes(321);
  const url = encodeDataUri(bytes, 'application/pdf');
  const dec = decodeDataUri(url);
  assert.equal(dec.mime, 'application/pdf');
  assert.ok(Buffer.compare(dec.bytes, bytes) === 0, 'bytes round-trip khớp');
});

await Case('documentKey / guideKey: khóa theo docId/version/ext gợi ý đúng', () => {
  assert.equal(documentKey('d1', 3, 'bao-cao.pdf', 'application/pdf'), 'documents/d1/v3.pdf');
  assert.equal(documentKey('d2', undefined, 'x.docx'), 'documents/d2/v1.docx', 'thiếu version -> v1');
  assert.equal(guideKey('g1', 'huong-dan.pdf', 'application/pdf'), 'guides/g1/file.pdf');
});

await Case('TÁCH khi S3 BẬT: bản ghi lưu có storageKey + size, KHÔNG còn dataUrl (chống phình DB)', async () => {
  const store = makeMemStore(true);
  const pdf = crypto.randomBytes(2048);
  const doc = {
    id: 'doc-a', name: 'ke-hoach.pdf', kind: 'main', mime: 'application/pdf', version: 1,
    dataUrl: encodeDataUri(pdf, 'application/pdf'), size: 0,
  };
  await externalizeDocumentWrite(doc, store);
  assert.equal(doc.dataUrl, undefined, 'base64 đã bị xóa khỏi bản ghi lưu DB');
  assert.equal(doc.storageKey, 'documents/doc-a/v1.pdf', 'có storageKey');
  assert.equal(doc.size, 2048, 'size = độ dài bytes thật');
  assert.ok(store._map.has('documents/doc-a/v1.pdf'), 'bytes đã PUT lên store');
});

await Case('DỰNG khi ĐỌC (S3 bật): dựng lại dataUrl từ S3, BYTES round-trip khớp gốc; bản ghi DB không đổi', async () => {
  const store = makeMemStore(true);
  const pdf = crypto.randomBytes(4096);
  const original = encodeDataUri(pdf, 'application/pdf');
  const doc = { id: 'doc-b', name: 'x.pdf', mime: 'application/pdf', version: 1, dataUrl: original };
  await externalizeDocumentWrite(doc, store); // -> storageKey, mất dataUrl
  assert.equal(doc.dataUrl, undefined);
  const readBack = await inlineDocumentRead(doc, store);
  assert.equal(readBack.dataUrl, original, 'dataUrl dựng lại KHỚP gốc byte-for-byte');
  assert.equal(doc.dataUrl, undefined, 'inline trả BẢN SAO — bản ghi gốc vẫn không có dataUrl');
  assert.equal(readBack.storageKey, 'documents/doc-b/v1.pdf', 'storageKey vẫn còn trên bản đọc (router/open sẽ ẩn khi cần)');
});

await Case('TƯƠNG THÍCH NGƯỢC — S3 TẮT: externalize là NO-OP, bản ghi giữ dataUrl base64 y như cũ', async () => {
  const store = makeMemStore(false);
  const url = encodeDataUri(crypto.randomBytes(64), 'application/pdf');
  const doc = { id: 'doc-c', name: 'x.pdf', mime: 'application/pdf', version: 1, dataUrl: url };
  await externalizeDocumentWrite(doc, store);
  assert.equal(doc.dataUrl, url, 'S3 tắt: dataUrl giữ nguyên trong bản ghi (hành vi cũ)');
  assert.equal(doc.storageKey, undefined, 'không set storageKey khi S3 tắt');
});

await Case('TƯƠNG THÍCH NGƯỢC — bản ghi CŨ chỉ có dataUrl (không storageKey): đọc trả nguyên, không gọi S3', async () => {
  const store = makeMemStore(true);
  const url = encodeDataUri(crypto.randomBytes(64), 'application/pdf');
  const legacy = { id: 'old', name: 'x.pdf', mime: 'application/pdf', dataUrl: url };
  const out = await inlineDocumentRead(legacy, store);
  assert.equal(out.dataUrl, url, 'bản ghi cũ đọc bình thường (dataUrl giữ nguyên)');
  assert.equal(out.storageKey, undefined);
});

await Case('Tài liệu SOẠN TRỰC TIẾP (content, không dataUrl): externalize bỏ qua, không tạo khóa S3', async () => {
  const store = makeMemStore(true);
  const doc = { id: 'doc-txt', name: 'ket-luan.pdf', content: 'Nội dung soạn tay', mime: 'application/pdf' };
  await externalizeDocumentWrite(doc, store);
  assert.equal(doc.storageKey, undefined, 'không có dataUrl -> không externalize');
  assert.equal(doc.content, 'Nội dung soạn tay', 'content giữ nguyên trong DB');
  assert.equal(store._map.size, 0, 'không PUT gì lên store');
});

await Case('GUIDES (HDSD): tách fileData->storageKey (S3 bật) rồi dựng lại fileData round-trip khớp', async () => {
  const store = makeMemStore(true);
  const bin = crypto.randomBytes(1500);
  const original = encodeDataUri(bin, 'application/pdf');
  const g = { id: 'g-1', title: 'HDSD', fileName: 'huong-dan.pdf', fileData: original };
  await externalizeGuideWrite(g, store);
  assert.equal(g.fileData, undefined, 'fileData base64 bị xóa khỏi bản ghi');
  assert.equal(g.storageKey, 'guides/g-1/file.pdf', 'có storageKey');
  const back = await inlineGuideRead(g, store);
  assert.ok(Buffer.compare(decodeDataUri(back.fileData).bytes, bin) === 0, 'fileData dựng lại khớp bytes gốc');
});

await Case('Ký PUT không rỗng: payloadHash = sha256(body) (không UNSIGNED) — chuỗi ký ổn định, hợp lệ', () => {
  const body = Buffer.from('tài liệu nhị phân');
  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
  const r = signRequestV4({
    method: 'PUT', canonicalUri: '/ecabinet/documents/d1/v1.pdf', query: {},
    headers: { host: 'minio:9000', 'x-amz-content-sha256': payloadHash, 'x-amz-date': '20150830T123600Z', 'content-type': 'application/pdf' },
    payloadHash, ...SV4,
  });
  assert.ok(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/service\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/.test(r.authorization),
    'Authorization PUT có đủ signed headers sắp xếp + chữ ký 64 hex');
});

// ============================================================
// TỐI ƯU 1 — PRESIGNED URL (SigV4 query-string). Xác minh bằng ROUND-TRIP:
// parse lại query của URL đã ký, TỰ TÍNH LẠI chữ ký y cách server ký, assert khớp.
// (đây là "test-vector" tự sinh có kiểm chứng chéo — chứng minh canonical query đúng chuẩn.)
// ============================================================

// Tự tính lại X-Amz-Signature từ URL presigned (độc lập với presignV4 để bắt sai lệch).
function recomputePresignSignature(urlStr, secretKey, region, service) {
  const u = new URL(urlStr);
  const host = u.host;
  const canonicalUri = u.pathname; // path đã encode giữ '/'
  const sp = u.searchParams;
  const given = sp.get('X-Amz-Signature');
  const amzDate = sp.get('X-Amz-Date');
  const dateStamp = amzDate.slice(0, 8);
  // canonical query = mọi tham số TRỪ X-Amz-Signature, encode + sort theo key đã encode.
  const pairs = [];
  for (const [k, v] of sp.entries()) {
    if (k === 'X-Amz-Signature') continue;
    pairs.push([uriEncode(k), uriEncode(v)]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canonicalQuery = pairs.map(([k, v]) => `${k}=${v}`).join('&');
  const canonicalRequest = ['GET', canonicalUri, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const key = signingKey(secretKey, dateStamp, region, service);
  const recomputed = crypto.createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');
  return { given, recomputed, sp };
}

await Case('PRESIGNED SigV4 round-trip: parse lại query -> tự tính X-Amz-Signature KHỚP; đủ tham số X-Amz-*', () => {
  const r = presignV4({
    method: 'GET', href: 'https://minio.example:9000/ecabinet-docs/documents/d1/v1.pdf',
    host: 'minio.example:9000', canonicalUri: '/ecabinet-docs/documents/d1/v1.pdf',
    expiresSec: 300, extraQuery: {}, ...SV4,
  });
  const { given, recomputed, sp } = recomputePresignSignature(r.url, SV4.secretKey, SV4.region, SV4.service);
  assert.equal(sp.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256', 'có X-Amz-Algorithm');
  assert.equal(sp.get('X-Amz-Credential'), `${SV4.accessKey}/${amzStamp()}/us-east-1/service/aws4_request`, 'X-Amz-Credential đúng scope');
  assert.equal(sp.get('X-Amz-SignedHeaders'), 'host', 'chỉ ký host');
  assert.ok(/^[0-9a-f]{64}$/.test(given), 'chữ ký 64 hex');
  assert.equal(recomputed, given, 'CHỮ KÝ TÍNH LẠI TỪ QUERY == chữ ký trong URL (canonical query đúng chuẩn)');
  assert.equal(given, r.signature, 'khớp cả signature presignV4 trả về');
});

function amzStamp() { return SV4.date.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8); }

await Case('PRESIGNED: TTL/expiry NẰM TRONG query (X-Amz-Date + X-Amz-Expires), kẹp biên 1..604800', () => {
  const r = presignV4({
    method: 'GET', href: 'https://h/b/k.pdf', host: 'h', canonicalUri: '/b/k.pdf',
    expiresSec: 120, ...SV4,
  });
  const sp = new URL(r.url).searchParams;
  assert.equal(sp.get('X-Amz-Expires'), '120', 'X-Amz-Expires = TTL truyền vào');
  assert.equal(sp.get('X-Amz-Date'), '20150830T123600Z', 'X-Amz-Date có trong query');
  assert.equal(r.expires, 120);
  // kẹp biên
  assert.equal(presignV4({ method: 'GET', href: 'https://h/k', host: 'h', canonicalUri: '/k', expiresSec: 0, ...SV4 }).expires, 1, 'kẹp dưới -> 1');
  assert.equal(presignV4({ method: 'GET', href: 'https://h/k', host: 'h', canonicalUri: '/k', expiresSec: 999999, ...SV4 }).expires, 604800, 'kẹp trên -> 7 ngày');
});

await Case('PRESIGNED: response-content-disposition (tên tiếng Việt) được ký trong query & giữ round-trip khớp', () => {
  const r = presignV4({
    method: 'GET', href: 'https://h/b/k.pdf', host: 'h', canonicalUri: '/b/k.pdf', expiresSec: 300,
    extraQuery: { 'response-content-disposition': "attachment; filename=\"bao-cao.pdf\"; filename*=UTF-8''" + uriEncode('Báo cáo.pdf') },
    ...SV4,
  });
  const { given, recomputed } = recomputePresignSignature(r.url, SV4.secretKey, SV4.region, SV4.service);
  assert.equal(recomputed, given, 'thêm response-content-disposition vào query -> vẫn ký/round-trip đúng');
});

await Case('presignGetUrl (blobStore): gắn attachment + filename* UTF-8; đổi TTL đổi URL; KHÔNG cấp khi S3 tắt', async () => {
  // Bơm env S3 tối thiểu để s3Config() != null, sau đó khôi phục.
  const saved = { ...process.env };
  Object.assign(process.env, {
    S3_ENDPOINT: 'https://minio.local:9000', S3_BUCKET: 'ecabinet-docs',
    S3_ACCESS_KEY: SV4.accessKey, S3_SECRET_KEY: SV4.secretKey, S3_REGION: 'us-east-1',
    S3_FORCE_PATH_STYLE: 'true',
  });
  const { blobStore: bs } = await import('../src/blob.js');
  const url = bs.presignGetUrl('documents/d1/v2.pdf', 300, { filename: 'Kế hoạch.pdf', contentType: 'application/pdf' });
  const sp = new URL(url).searchParams;
  assert.ok(url.includes('/ecabinet-docs/documents/d1/v2.pdf'), 'path-style bucket/key đúng');
  assert.match(sp.get('response-content-disposition') ?? '', /attachment; filename="K.*\.pdf"; filename\*=UTF-8''/, 'disposition attachment + filename* UTF-8');
  assert.equal(sp.get('X-Amz-Expires'), '300', 'TTL mặc định 300');
  const url60 = bs.presignGetUrl('documents/d1/v2.pdf', 60, {});
  assert.notEqual(url, url60, 'đổi TTL -> URL (chữ ký) khác');
  assert.equal(new URL(url60).searchParams.get('X-Amz-Expires'), '60');
  // Round-trip xác minh chữ ký (không log URL trong code thật; test có thể kiểm)
  const { recomputed, given } = recomputePresignSignature(url, SV4.secretKey, 'us-east-1', 's3');
  assert.equal(recomputed, given, 'presignGetUrl round-trip chữ ký khớp');
  // Tắt S3 -> ném
  process.env = { ...saved };
  delete process.env.S3_ENDPOINT; delete process.env.S3_BUCKET; delete process.env.S3_ACCESS_KEY; delete process.env.S3_SECRET_KEY;
  const { blobStore: bs2 } = await import('../src/blob.js?off=1');
  assert.throws(() => bs2.presignGetUrl('k', 300, {}), /chưa cấu hình/, 'S3 tắt: presignGetUrl ném (điểm gọi đã kiểm configured trước)');
  process.env = saved;
});

// ============================================================
// TỐI ƯU 2 — GOM KHÓA S3 CẦN DỌN KHI XÓA (đa version) + best-effort không ném.
// ============================================================
await Case('documentStorageKeys: gom storageKey hiện tại + mọi version cũ (versions[]), loại trùng/rỗng', () => {
  assert.deepEqual(documentStorageKeys({ storageKey: 'documents/d1/v3.pdf' }), ['documents/d1/v3.pdf']);
  assert.deepEqual(
    documentStorageKeys({ storageKey: 'documents/d1/v3.pdf', versions: [
      { storageKey: 'documents/d1/v1.pdf' }, { storageKey: 'documents/d1/v2.pdf' },
      { storageKey: 'documents/d1/v3.pdf' }, { note: 'không có key' }, { storageKey: '' },
    ] }).sort(),
    ['documents/d1/v1.pdf', 'documents/d1/v2.pdf', 'documents/d1/v3.pdf'],
    'gom hết version + loại trùng key hiện tại + bỏ rỗng/thiếu',
  );
  assert.deepEqual(documentStorageKeys({ content: 'soạn tay' }), [], 'không tệp -> không khóa');
  assert.deepEqual(guideStorageKeys({ storageKey: 'guides/g1/file.pdf' }), ['guides/g1/file.pdf']);
  assert.deepEqual(guideStorageKeys({}), []);
});

await Case('XÓA best-effort: blob.delete được gọi ĐÚNG mọi key; S3 lỗi -> KHÔNG ném (mô phỏng vòng dọn)', async () => {
  // Mô phỏng đúng vòng lặp dọn ở index.js DELETE: gọi delete từng key, nuốt lỗi + log.
  const calls = [];
  const failing = {
    configured: () => true,
    async delete(k) { calls.push(k); if (k.endsWith('v2.pdf')) throw new Error('S3 5xx'); },
  };
  const doc = { id: 'd1', storageKey: 'documents/d1/v3.pdf', versions: [{ storageKey: 'documents/d1/v2.pdf' }] };
  const keys = documentStorageKeys(doc);
  let threw = false;
  try {
    for (const k of keys) {
      try { await failing.delete(k); } catch { /* best-effort: nuốt lỗi, chỉ log ở code thật */ }
    }
  } catch { threw = true; }
  assert.equal(threw, false, 'lỗi S3 khi dọn KHÔNG lan ra (nghiệp vụ xóa vẫn thành công)');
  assert.deepEqual(calls.sort(), ['documents/d1/v2.pdf', 'documents/d1/v3.pdf'], 'delete gọi đúng TỪNG key liên quan doc');
});

// ============================================================
// ĐỢT 3 — ĐƯỜNG XEM dùng contentUrl thay base64 + query mode override + escape S3_INLINE_READ.
// (hàm THUẦN — không HTTP; chiếu bản ghi + phân giải chế độ tải.)
// ============================================================

await Case('downloadModeFrom: query ?mode= ƯU TIÊN hơn env; giá trị lạ -> theo env; parity redirect mặc định', () => {
  const saved = process.env.S3_DOWNLOAD_MODE;
  delete process.env.S3_DOWNLOAD_MODE;
  // Không env, không query -> mặc định redirect
  assert.equal(downloadModeFrom(new URLSearchParams('')), 'redirect', 'mặc định redirect');
  assert.equal(downloadModeFrom(new URLSearchParams('mode=stream')), 'stream', 'query=stream -> stream');
  assert.equal(downloadModeFrom(new URLSearchParams('mode=redirect')), 'redirect', 'query=redirect -> redirect');
  assert.equal(downloadModeFrom(new URLSearchParams('mode=xyz')), 'redirect', 'query lạ -> theo env (redirect)');
  // env=stream, query rỗng -> stream (theo env); query=redirect GHI ĐÈ env -> redirect
  process.env.S3_DOWNLOAD_MODE = 'stream';
  assert.equal(downloadMode(), 'stream', 'env stream');
  assert.equal(downloadModeFrom(new URLSearchParams('')), 'stream', 'không query -> theo env stream');
  assert.equal(downloadModeFrom(new URLSearchParams('mode=redirect')), 'redirect', 'query=redirect ưu tiên GHI ĐÈ env=stream');
  assert.equal(downloadModeFrom({ mode: 'stream' }), 'stream', 'nhận cả object {mode} (không chỉ URLSearchParams)');
  if (saved === undefined) delete process.env.S3_DOWNLOAD_MODE; else process.env.S3_DOWNLOAD_MODE = saved;
});

await Case('inlineReadEnabled: mặc định TẮT; chỉ bật khi S3_INLINE_READ=on (không phân biệt hoa/thường)', () => {
  const saved = process.env.S3_INLINE_READ;
  delete process.env.S3_INLINE_READ;
  assert.equal(inlineReadEnabled(), false, 'mặc định TẮT (đợt 3 trả contentUrl)');
  process.env.S3_INLINE_READ = 'on';
  assert.equal(inlineReadEnabled(), true, 'on -> bật');
  process.env.S3_INLINE_READ = 'ON';
  assert.equal(inlineReadEnabled(), true, 'ON -> bật (case-insensitive)');
  process.env.S3_INLINE_READ = 'true';
  assert.equal(inlineReadEnabled(), false, "chỉ 'on' mới bật (giá trị khác -> tắt)");
  if (saved === undefined) delete process.env.S3_INLINE_READ; else process.env.S3_INLINE_READ = saved;
});

await Case('GET doc (đã externalize): projectDocumentRead -> có contentUrl, KHÔNG dataUrl, KHÔNG storageKey', () => {
  const rec = { id: 'doc-x', name: 'kế hoạch.pdf', kind: 'main', mime: 'application/pdf', version: 2, size: 1234, storageKey: 'documents/doc-x/v2.pdf' };
  const out = projectDocumentRead(rec);
  assert.equal(out.contentUrl, '/api/documents/doc-x/download', 'contentUrl trỏ endpoint /download (tương đối same-origin)');
  assert.equal(out.dataUrl, undefined, 'KHÔNG dựng base64 (đường XEM không nhồi base64)');
  assert.equal(out.storageKey, undefined, 'KHÔNG lộ khóa S3 ra client');
  assert.equal(out.size, 1234, 'metadata khác giữ nguyên');
  assert.equal(rec.storageKey, 'documents/doc-x/v2.pdf', 'trả BẢN SAO — bản ghi gốc còn storageKey');
});

await Case('GET doc encode id có ký tự đặc biệt trong contentUrl (an toàn URL)', () => {
  const out = projectDocumentRead({ id: 'a/b c', name: 'x.pdf', storageKey: 'documents/x/v1.pdf' });
  assert.equal(out.contentUrl, '/api/documents/a%2Fb%20c/download', 'id được encodeURIComponent');
});

await Case('GET doc bản ghi CŨ (còn dataUrl trong DB): projectDocumentRead GIỮ NGUYÊN dataUrl, không contentUrl', () => {
  const url = encodeDataUri(crypto.randomBytes(32), 'application/pdf');
  const rec = { id: 'old', name: 'x.pdf', mime: 'application/pdf', dataUrl: url };
  const out = projectDocumentRead(rec);
  assert.equal(out.dataUrl, url, 'bản ghi cũ vẫn trả dataUrl (tương thích ngược)');
  assert.equal(out.contentUrl, undefined, 'không thêm contentUrl khi đã có dataUrl');
});

await Case('GET doc SOẠN TAY (content, không tệp): projectDocumentRead trả nguyên (không storageKey/contentUrl/dataUrl)', () => {
  const rec = { id: 'txt', name: 'ket-luan.pdf', content: 'Nội dung soạn tay', mime: 'application/pdf' };
  const out = projectDocumentRead(rec);
  assert.equal(out.content, 'Nội dung soạn tay', 'content giữ nguyên');
  assert.equal(out.contentUrl, undefined, 'không tệp -> không contentUrl');
  assert.equal(out.storageKey, undefined);
  assert.equal(out.dataUrl, undefined);
});

await Case('S3_INLINE_READ=on: điểm móc GET dựng lại dataUrl từ S3 (KHÔI PHỤC hành vi cũ) — round-trip khớp', async () => {
  // Mô phỏng đúng nhánh index.js: inlineReadEnabled() -> inlineDocumentRead(readable) (KHÔNG project).
  const store = makeMemStore(true);
  const pdf = crypto.randomBytes(2048);
  const original = encodeDataUri(pdf, 'application/pdf');
  const doc = { id: 'doc-inl', name: 'x.pdf', mime: 'application/pdf', version: 1, dataUrl: original };
  await externalizeDocumentWrite(doc, store); // -> storageKey, mất dataUrl
  const saved = process.env.S3_INLINE_READ;
  process.env.S3_INLINE_READ = 'on';
  // nhánh escape: dựng lại dataUrl (không dùng project)
  const readBack = inlineReadEnabled() ? await inlineDocumentRead(doc, store) : projectDocumentRead(doc);
  assert.equal(readBack.dataUrl, original, 'escape on: dataUrl dựng lại KHỚP gốc (hành vi cũ)');
  assert.equal(readBack.contentUrl, undefined, 'escape on: KHÔNG kèm contentUrl (đường cũ)');
  // Tắt escape -> project trả contentUrl
  process.env.S3_INLINE_READ = '';
  const projected = inlineReadEnabled() ? await inlineDocumentRead(doc, store) : projectDocumentRead(doc);
  assert.equal(projected.contentUrl, '/api/documents/doc-inl/download', 'escape off: trả contentUrl');
  assert.equal(projected.dataUrl, undefined, 'escape off: KHÔNG dataUrl');
  if (saved === undefined) delete process.env.S3_INLINE_READ; else process.env.S3_INLINE_READ = saved;
});

await Case('GUIDES (đợt 3): projectGuideRead có contentUrl /api/guides/<id>/download, ẩn storageKey; bản ghi cũ giữ fileData', () => {
  const rec = { id: 'g-x', title: 'HDSD', fileName: 'huong-dan.pdf', storageKey: 'guides/g-x/file.pdf' };
  const out = projectGuideRead(rec);
  assert.equal(out.contentUrl, '/api/guides/g-x/download', 'guide contentUrl đúng endpoint');
  assert.equal(out.fileData, undefined, 'không dựng base64');
  assert.equal(out.storageKey, undefined, 'ẩn khóa S3');
  // bản ghi cũ còn fileData
  const url = encodeDataUri(crypto.randomBytes(16), 'application/pdf');
  const legacy = { id: 'g-old', title: 'HDSD cũ', fileData: url };
  const outL = projectGuideRead(legacy);
  assert.equal(outL.fileData, url, 'guide cũ giữ fileData (tương thích ngược)');
  assert.equal(outL.contentUrl, undefined, 'không thêm contentUrl khi đã có fileData');
});

const exitCode = report();
process.exit(exitCode);

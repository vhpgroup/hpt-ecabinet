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

const exitCode = report();
process.exit(exitCode);

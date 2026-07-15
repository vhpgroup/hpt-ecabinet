// ============================================================
// PHIẾU LẤY Ý KIẾN — xin ý kiến ngoài phiên họp, có thời hạn
// ============================================================
import React, { useMemo, useState } from 'react';
import type { DocFile, Vote } from '../../domain/types';
import { useApp } from '../../store/AppContext';
import { Badge, EmptyState, Field, Icon, Modal, PageHeader, VoteOutcomePanel, VoteResultBars } from '../components';
import { can } from '../../services/authService';
import * as voteService from '../../services/voteService';
import { fmtDT, indexBy, timeAgo, toLocalInput, fromLocalInput } from '../format';
import { DocViewerModal } from './shared';

export default function PollsPage() {
  const { user, s, refresh, toast } = useApp();
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocFile | null>(null);
  const docById = indexBy(s.documents);

  const polls = useMemo(() => {
    let arr = s.votes.filter((v) => v.kind === 'poll');
    if (filter === 'open') arr = arr.filter((v) => v.status === 'open');
    if (filter === 'closed') arr = arr.filter((v) => v.status === 'closed');
    return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [s.votes, filter]);

  return (
    <div>
      <PageHeader title="Lấy ý kiến" subtitle="Gửi phiếu xin ý kiến thành viên kèm tài liệu, tổng hợp tự động"
        actions={can.manageMeetings(user) && (
          <button className="btn" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} />Tạo phiếu lấy ý kiến</button>
        )} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={'btn sm' + (filter === 'open' ? '' : ' outline')} onClick={() => setFilter('open')}>Đang mở</button>
        <button className={'btn sm' + (filter === 'closed' ? '' : ' outline')} onClick={() => setFilter('closed')}>Đã kết thúc</button>
        <button className={'btn sm' + (filter === 'all' ? '' : ' outline')} onClick={() => setFilter('all')}>Tất cả</button>
      </div>

      {polls.length === 0 && <div className="card"><EmptyState icon="vote" text="Không có phiếu lấy ý kiến nào" /></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {polls.map((p) => (
          <PollCard key={p.id} p={p} onViewDoc={(did) => { const d = docById.get(did); if (d) setViewDoc(d); }} />
        ))}
      </div>

      {createOpen && <PollCreateModal onClose={() => setCreateOpen(false)} onDone={async () => { setCreateOpen(false); await refresh(); toast('Đã gửi phiếu lấy ý kiến đến các thành viên'); }} />}
      {viewDoc && <DocViewerModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

function PollCard({ p, onViewDoc }: { p: Vote; onViewDoc: (docId: string) => void }) {
  const { user, s, refresh, toast } = useApp();
  const [optionId, setOptionId] = useState('');
  const [comment, setComment] = useState('');
  const users = indexBy(s.users);
  const myBallot = p.ballots.find((b) => b.userId === user?.id);
  const eligible = !!user && p.eligibleIds.includes(user.id);
  const canRespond = p.status === 'open' && eligible && !myBallot;
  const isOwner = p.createdBy === user?.id || can.manageMeetings(user);
  const overdue = p.deadline && new Date(p.deadline).getTime() < Date.now();
  const showResults = p.status === 'closed' || myBallot || isOwner;
  const comments = p.ballots.filter((b) => b.comment);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); await refresh(); if (msg) toast(msg); }
    catch (ex) { toast((ex as Error).message, 'error'); }
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b style={{ color: 'var(--navy)', fontSize: 15 }}>{p.title}</b>
          {p.description && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{p.description}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge color={p.status === 'open' ? 'green' : 'navy'}>{p.status === 'open' ? 'Đang lấy ý kiến' : 'Đã kết thúc'}</Badge>
            {p.deadline && (
              <Badge color={overdue && p.status === 'open' ? 'red' : 'amber'}>
                Hạn: {fmtDT(p.deadline)}
              </Badge>
            )}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {users.get(p.createdBy)?.fullName} gửi {timeAgo(p.createdAt)} · {p.ballots.length}/{p.eligibleIds.length} phản hồi
            </span>
          </div>
          {p.documentIds.length > 0 && (
            <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
              {p.documentIds.map((did) => (
                <button key={did} className="btn outline sm" onClick={() => onViewDoc(did)}>
                  <Icon name="file" size={13} />Tài liệu kèm theo
                </button>
              ))}
            </div>
          )}
        </div>
        {isOwner && p.status === 'open' && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {p.ballots.length < p.eligibleIds.length && (
              <button className="btn outline sm"
                title="Gửi thông báo nhắc những người chưa phản hồi"
                onClick={() => act(async () => {
                  const n = await voteService.remindPoll(user!, p.id);
                  toast(n > 0 ? `Đã gửi nhắc đến ${n} người chưa cho ý kiến` : 'Tất cả đã phản hồi', n > 0 ? 'success' : 'info');
                })}>
                <Icon name="bell" size={13} />Nhắc ({p.eligibleIds.length - p.ballots.length})
              </button>
            )}
            <button className="btn danger sm" onClick={() => act(() => voteService.closeVote(user!, p.id), 'Đã kết thúc lấy ý kiến')}>Kết thúc</button>
          </div>
        )}
      </div>

      {canRespond && (
        <div style={{ marginTop: 12, background: '#f4f8fd', border: '1px solid #d7e5f5', borderRadius: 11, padding: '12px 14px' }}>
          <b style={{ fontSize: 13 }}>Ý kiến của bạn:</b>
          <div style={{ display: 'flex', gap: 14, margin: '8px 0', flexWrap: 'wrap' }}>
            {p.options.map((o) => (
              <label key={o.id} className="checkline" style={{ marginBottom: 0 }}>
                <input type="radio" name={'p' + p.id} checked={optionId === o.id} onChange={() => setOptionId(o.id)} />
                {o.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="inp" placeholder="Nội dung góp ý (không bắt buộc)…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn" disabled={!optionId}
              onClick={() => act(async () => { await voteService.castBallot(user!, p.id, optionId, comment.trim() || undefined); setComment(''); }, 'Đã gửi ý kiến của bạn')}>
              Gửi ý kiến
            </button>
          </div>
        </div>
      )}
      {myBallot && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: 'var(--green)', fontWeight: 600 }}>
          ✓ Bạn đã cho ý kiến: {p.options.find((o) => o.id === myBallot.optionId)?.label}
        </p>
      )}
      {p.status === 'open' && eligible && !myBallot && p.deadline && (
        <p style={{ fontSize: 12, marginTop: 8, color: overdue ? 'var(--red)' : 'var(--muted)' }}>
          {overdue ? '⚠ Đã quá hạn cho ý kiến — vui lòng phản hồi ngay.' : 'Hệ thống sẽ nhắc khi sắp đến hạn.'}
        </p>
      )}

      {showResults && (
        <div style={{ marginTop: 12 }}>
          {/* Phiếu lấy ý kiến mặc định KHÔNG ép nhãn thông qua; chỉ khi có approveOptionId */}
          {p.approveOptionId && <VoteOutcomePanel vote={p} />}
          <VoteResultBars vote={p} />
          {comments.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <b style={{ fontSize: 12.5, color: 'var(--muted)' }}>Tổng hợp ý kiến góp ý:</b>
              {comments.map((b, i) => (
                <div key={i} className="anno" style={{ marginTop: 6 }}>
                  {b.comment}
                  <small>{users.get(b.userId)?.fullName} · {timeAgo(b.castAt)}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PollCreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user, s } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const d = new Date(Date.now() + 3 * 24 * 3600e3); d.setHours(17, 0, 0, 0);
  const [deadline, setDeadline] = useState(toLocalInput(d.toISOString()));
  const [opts, setOpts] = useState(['Nhất trí', 'Nhất trí, có chỉnh sửa bổ sung', 'Không nhất trí']);
  const [ids, setIds] = useState<string[]>(s.users.filter((u) => u.status === 'active' && u.role !== 'admin' && u.id !== user?.id).map((u) => u.id));
  const [docIds, setDocIds] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const attachable = s.documents.filter((dx) => dx.kind !== 'personal' || dx.ownerId === user?.id);

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return setErr('Nhập nội dung xin ý kiến');
    if (!ids.length) return setErr('Chọn ít nhất một thành viên');
    try {
      await voteService.createVote(user, {
        kind: 'poll', title: title.trim(), description: description.trim() || undefined,
        optionLabels: opts, secret: false, deadline: fromLocalInput(deadline),
        documentIds: docIds, eligibleIds: ids,
      });
      onDone();
    } catch (ex) { setErr((ex as Error).message); }
  };

  return (
    <Modal title="Tạo phiếu lấy ý kiến" onClose={onClose} width={640}
      footer={<>
        {err && <span style={{ color: 'var(--red)', fontSize: 13, marginRight: 'auto' }}>{err}</span>}
        <button className="btn outline" onClick={onClose}>Hủy</button>
        <button className="btn" onClick={submit}><Icon name="send" size={15} />Gửi phiếu</button>
      </>}>
      <Field label="Nội dung xin ý kiến" required>
        <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lấy ý kiến dự thảo Quyết định…" />
      </Field>
      <Field label="Mô tả"><textarea className="ta" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Hạn cho ý kiến" required><input type="datetime-local" className="inp" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      <Field label="Phương án trả lời">
        {opts.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input className="inp" value={o} onChange={(e) => setOpts(opts.map((x, ix) => ix === i ? e.target.value : x))} />
            <button className="icon-btn" onClick={() => setOpts(opts.filter((_, ix) => ix !== i))}><Icon name="trash" size={15} /></button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setOpts([...opts, ''])}><Icon name="plus" size={14} />Thêm phương án</button>
      </Field>
      <Field label={`Gửi tới (${ids.length} thành viên)`}>
        <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 13px' }}>
          {s.users.filter((u) => u.status === 'active' && u.id !== user?.id).map((u) => (
            <label className="checkline" key={u.id}>
              <input type="checkbox" checked={ids.includes(u.id)}
                onChange={() => setIds((x) => x.includes(u.id) ? x.filter((y) => y !== u.id) : [...x, u.id])} />
              {u.fullName} <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>— {u.title}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Tài liệu kèm theo">
        <select className="sel" value="" onChange={(e) => { if (e.target.value && !docIds.includes(e.target.value)) setDocIds([...docIds, e.target.value]); }}>
          <option value="">— Chọn tài liệu có sẵn để đính kèm —</option>
          {attachable.map((dx) => <option key={dx.id} value={dx.id}>{dx.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
          {docIds.map((did) => {
            const dx = s.documents.find((x) => x.id === did);
            return (
              <Badge key={did} color="blue">
                {dx?.name}
                <a style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setDocIds(docIds.filter((x) => x !== did))}>✕</a>
              </Badge>
            );
          })}
        </div>
      </Field>
    </Modal>
  );
}

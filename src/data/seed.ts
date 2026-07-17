// ============================================================
// DỮ LIỆU MẪU (SEED) — mô phỏng hoạt động của một UBND tỉnh.
// Ngày giờ được sinh TƯƠNG ĐỐI so với thời điểm mở app lần đầu
// để demo luôn có: 1 phiên đang diễn ra, phiên sắp tới, phiên đã kết thúc.
// ============================================================
import type { Snapshot } from '../domain/types';

export function buildSeed(): Snapshot {
  // Ngày giờ tính TẠI THỜI ĐIỂM GỌI — server reset lúc nào cũng có dữ liệu "sống"
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const minAgo = (m: number) => new Date(now.getTime() - m * 60000);
  const minFromNow = (m: number) => new Date(now.getTime() + m * 60000);
  const dayAt = (offsetDays: number, h: number, mi = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(h, mi, 0, 0);
    return d;
  };

  // ---------------- Đơn vị ----------------
  const units = [
    { id: 'un-vp', name: 'Văn phòng UBND tỉnh', short: 'VP UBND', order: 1 },
    { id: 'un-khdt', name: 'Sở Kế hoạch và Đầu tư', short: 'Sở KH&ĐT', order: 2 },
    { id: 'un-tc', name: 'Sở Tài chính', short: 'Sở TC', order: 3 },
    { id: 'un-xd', name: 'Sở Xây dựng', short: 'Sở XD', order: 4 },
    { id: 'un-tnmt', name: 'Sở Tài nguyên và Môi trường', short: 'Sở TN&MT', order: 5 },
    { id: 'un-gtvt', name: 'Sở Giao thông vận tải', short: 'Sở GTVT', order: 6 },
    { id: 'un-yt', name: 'Sở Y tế', short: 'Sở YT', order: 7 },
    { id: 'un-gd', name: 'Sở Giáo dục và Đào tạo', short: 'Sở GD&ĐT', order: 8 },
    { id: 'un-tt', name: 'Sở Thông tin và Truyền thông', short: 'Sở TT&TT', order: 9 },
  ];

  // ---------------- Người dùng ----------------
  const P = '123456';
  const users = [
    { id: 'u-admin', username: 'quantri', password: P, fullName: 'Đỗ Quang Trị', title: 'Chuyên viên CNTT — Quản trị hệ thống', unitId: 'un-vp', role: 'admin', email: 'quantri@tinh.gov.vn', phone: '0912 000 001', avatarColor: '#334155', status: 'active' },
    { id: 'u-ct', username: 'chutich', password: P, fullName: 'Trần Đại Nghĩa', title: 'Chủ tịch UBND tỉnh', unitId: 'un-vp', role: 'chairman', email: 'chutich@tinh.gov.vn', phone: '0912 000 002', avatarColor: '#0f4c92', status: 'active' },
    { id: 'u-pct', username: 'phochutich', password: P, fullName: 'Lê Minh Khuê', title: 'Phó Chủ tịch UBND tỉnh', unitId: 'un-vp', role: 'chairman', email: 'phochutich@tinh.gov.vn', phone: '0912 000 003', avatarColor: '#0e7490', status: 'active' },
    { id: 'u-tk', username: 'thuky', password: P, fullName: 'Phạm Văn Thư', title: 'Chánh Văn phòng UBND tỉnh', unitId: 'un-vp', role: 'secretary', email: 'thuky@tinh.gov.vn', phone: '0912 000 004', avatarColor: '#7c3aed', status: 'active' },
    { id: 'u-khdt', username: 'sokhdt', password: P, fullName: 'Nguyễn Hoài An', title: 'Giám đốc Sở Kế hoạch và Đầu tư', unitId: 'un-khdt', role: 'delegate', email: 'an.nh@tinh.gov.vn', phone: '0912 000 005', avatarColor: '#1d9e5f', status: 'active' },
    { id: 'u-tc', username: 'sotc', password: P, fullName: 'Vũ Thị Hồng', title: 'Giám đốc Sở Tài chính', unitId: 'un-tc', role: 'delegate', email: 'hong.vt@tinh.gov.vn', phone: '0912 000 006', avatarColor: '#d97706', status: 'active' },
    { id: 'u-xd', username: 'soxd', password: P, fullName: 'Đặng Quốc Bảo', title: 'Giám đốc Sở Xây dựng', unitId: 'un-xd', role: 'delegate', email: 'bao.dq@tinh.gov.vn', phone: '0912 000 007', avatarColor: '#b45309', status: 'active' },
    { id: 'u-pxd', username: 'phosoxd', password: P, fullName: 'Trần Thị Lan Anh', title: 'Phó Giám đốc Sở Xây dựng', unitId: 'un-xd', role: 'delegate', email: 'lananh.tt@tinh.gov.vn', phone: '0912 000 008', avatarColor: '#be185d', status: 'active' },
    { id: 'u-tnmt', username: 'sotnmt', password: P, fullName: 'Hoàng Thu Trang', title: 'Giám đốc Sở Tài nguyên và Môi trường', unitId: 'un-tnmt', role: 'delegate', email: 'trang.ht@tinh.gov.vn', phone: '0912 000 009', avatarColor: '#0d9488', status: 'active' },
    { id: 'u-gtvt', username: 'sogtvt', password: P, fullName: 'Bùi Đức Long', title: 'Giám đốc Sở Giao thông vận tải', unitId: 'un-gtvt', role: 'delegate', email: 'long.bd@tinh.gov.vn', phone: '0912 000 010', avatarColor: '#4338ca', status: 'active' },
    { id: 'u-yt', username: 'soyt', password: P, fullName: 'Lương Thị Mai', title: 'Giám đốc Sở Y tế', unitId: 'un-yt', role: 'delegate', email: 'mai.lt@tinh.gov.vn', phone: '0912 000 011', avatarColor: '#d64545', status: 'active' },
    { id: 'u-gd', username: 'sogddt', password: P, fullName: 'Trịnh Văn Sáng', title: 'Giám đốc Sở Giáo dục và Đào tạo', unitId: 'un-gd', role: 'delegate', email: 'sang.tv@tinh.gov.vn', phone: '0912 000 012', avatarColor: '#65a30d', status: 'active' },
    { id: 'u-tt', username: 'sotttt', password: P, fullName: 'Ngô Gia Huy', title: 'Giám đốc Sở Thông tin và Truyền thông', unitId: 'un-tt', role: 'delegate', email: 'huy.ng@tinh.gov.vn', phone: '0912 000 013', avatarColor: '#0369a1', status: 'active' },
  ] as Snapshot['users'];

  // ---------------- Phòng họp ----------------
  const rooms = [
    { id: 'r1', name: 'Phòng họp số 1', location: 'Tầng 3, Trụ sở UBND tỉnh', capacity: 40, equipment: ['Màn hình LED 85"', 'Âm thanh hội nghị', 'Camera PTZ', 'Máy quét QR điểm danh'], supportsOnline: true, status: 'active' },
    { id: 'r2', name: 'Hội trường A', location: 'Tầng 1, Trụ sở UBND tỉnh', capacity: 120, equipment: ['Sân khấu', 'Máy chiếu 4K', 'Hệ thống âm thanh lớn'], supportsOnline: false, status: 'active' },
    { id: 'r3', name: 'Phòng họp trực tuyến', location: 'Tầng 5, Trụ sở UBND tỉnh', capacity: 20, equipment: ['Thiết bị hội nghị truyền hình', 'Micro đa hướng'], supportsOnline: true, status: 'active' },
  ] as Snapshot['rooms'];

  // ---------------- Tài liệu ----------------
  const docText = {
    ktxh: `ỦY BAN NHÂN DÂN TỈNH\n\nBÁO CÁO\nTình hình kinh tế – xã hội 6 tháng đầu năm 2026 và nhiệm vụ trọng tâm 6 tháng cuối năm\n\nI. KẾT QUẢ ĐẠT ĐƯỢC\n1. Tăng trưởng kinh tế (GRDP) 6 tháng đầu năm ước đạt 8,42%, cao hơn cùng kỳ năm 2025 (7,65%); trong đó khu vực công nghiệp – xây dựng tăng 10,3%, dịch vụ tăng 8,1%, nông – lâm – thủy sản tăng 3,4%.\n2. Thu ngân sách nhà nước trên địa bàn đạt 9.860 tỷ đồng, bằng 58,2% dự toán, tăng 12,4% so với cùng kỳ. Giải ngân vốn đầu tư công đạt 41,6% kế hoạch.\n3. Toàn tỉnh thu hút 28 dự án đầu tư mới với tổng vốn đăng ký 12.450 tỷ đồng; thành lập mới 642 doanh nghiệp, tăng 9,8%.\n4. Các lĩnh vực văn hóa – xã hội tiếp tục được quan tâm; an sinh xã hội được bảo đảm; quốc phòng – an ninh được giữ vững.\n\nII. TỒN TẠI, HẠN CHẾ\n1. Tiến độ giải phóng mặt bằng một số dự án trọng điểm còn chậm, nhất là Dự án đường vành đai phía Đông.\n2. Giải ngân vốn đầu tư công tuy cao hơn bình quân cả nước nhưng chưa đạt kịch bản đề ra (45%).\n3. Tình trạng thiếu nhân lực y tế cơ sở, giáo viên một số môn học đặc thù chưa được khắc phục triệt để.\n\nIII. NHIỆM VỤ TRỌNG TÂM 6 THÁNG CUỐI NĂM\n1. Tập trung tháo gỡ khó khăn, phấn đấu giải ngân 100% kế hoạch vốn đầu tư công năm 2026.\n2. Hoàn thành phê duyệt Kế hoạch chuyển đổi số tỉnh giai đoạn 2026–2030.\n3. Đẩy nhanh tiến độ các dự án hạ tầng chiến lược, các khu – cụm công nghiệp.\n4. Chuẩn bị tốt các điều kiện cho năm học mới 2026–2027 và công tác phòng, chống thiên tai.`,
    phuluc: `PHỤ LỤC SỐ LIỆU KINH TẾ – XÃ HỘI 6 THÁNG ĐẦU NĂM 2026\n\nChỉ tiêu | Kế hoạch năm | Thực hiện 6 tháng | % KH\nTăng trưởng GRDP | 8,5% | 8,42% | —\nThu NSNN (tỷ đồng) | 16.950 | 9.860 | 58,2%\nGiải ngân ĐTC (tỷ đồng) | 7.200 | 2.995 | 41,6%\nKim ngạch xuất khẩu (triệu USD) | 2.400 | 1.310 | 54,6%\nKhách du lịch (triệu lượt) | 8,0 | 4,35 | 54,4%\nDoanh nghiệp thành lập mới | 1.200 | 642 | 53,5%\nTỷ lệ hồ sơ TTHC trực tuyến | 90% | 86,4% | —\nSố xã đạt chuẩn NTM nâng cao | 12 | 5 | 41,7%`,
    totrinh: `TỜ TRÌNH\nVề việc phân bổ kế hoạch vốn đầu tư công đợt 2 năm 2026\n\nKính gửi: Ủy ban nhân dân tỉnh\n\nCăn cứ Luật Đầu tư công; căn cứ Nghị quyết của HĐND tỉnh về kế hoạch đầu tư công năm 2026;\nSở Tài chính trình UBND tỉnh phương án phân bổ 850 tỷ đồng kế hoạch vốn đợt 2 năm 2026 như sau:\n\n1. Lĩnh vực giao thông: 380 tỷ đồng (44,7%) — ưu tiên Dự án đường vành đai phía Đông và 03 tuyến đường liên huyện.\n2. Lĩnh vực y tế – giáo dục: 240 tỷ đồng (28,2%) — nâng cấp 02 bệnh viện tuyến huyện, xây mới 12 phòng học bộ môn.\n3. Hạ tầng số và chuyển đổi số: 130 tỷ đồng (15,3%) — trung tâm dữ liệu tỉnh, hệ thống họp không giấy giai đoạn 2.\n4. Nông nghiệp – thủy lợi: 100 tỷ đồng (11,8%) — kiên cố hóa kênh mương, hồ chứa.\n\nSở Tài chính kính trình UBND tỉnh xem xét, quyết nghị./.`,
    vanhdai: `BÁO CÁO\nTiến độ thực hiện Dự án đường vành đai phía Đông\n\n1. Khối lượng thi công: đạt 62,5% giá trị hợp đồng, chậm 4,2% so với kế hoạch.\n2. Giải phóng mặt bằng: đã bàn giao 91,3% diện tích; còn 27 hộ dân tại xã Đông Phú chưa nhận tiền bồi thường.\n3. Vướng mắc chính: (i) giá vật liệu đắp nền tăng 18%; (ii) 1,2 km đoạn qua khu dân cư chưa hoàn thành tái định cư.\n4. Kiến nghị: UBND tỉnh chỉ đạo Sở TN&MT và UBND huyện Đông Hải hoàn thành GPMB trước 15/8/2026; cho phép điều chỉnh nguồn vật liệu tại mỏ Đông Sơn.`,
    nghiquyet: `DỰ THẢO\nNGHỊ QUYẾT PHIÊN HỌP THƯỜNG KỲ UBND TỈNH THÁNG 7/2026\n\nĐiều 1. Thông qua Báo cáo tình hình kinh tế – xã hội 6 tháng đầu năm 2026; thống nhất 04 nhóm nhiệm vụ trọng tâm 6 tháng cuối năm.\nĐiều 2. Thống nhất chủ trương phân bổ 850 tỷ đồng kế hoạch vốn đầu tư công đợt 2 năm 2026 theo Tờ trình của Sở Tài chính.\nĐiều 3. Giao Sở TN&MT chủ trì, phối hợp UBND huyện Đông Hải hoàn thành giải phóng mặt bằng Dự án đường vành đai phía Đông trước ngày 15/8/2026.\nĐiều 4. Văn phòng UBND tỉnh theo dõi, đôn đốc việc thực hiện Nghị quyết này./.`,
    quyche: `QUY CHẾ LÀM VIỆC CỦA ỦY BAN NHÂN DÂN TỈNH\n(Trích)\n\nĐiều 12. Phiên họp UBND tỉnh\n1. UBND tỉnh họp thường kỳ mỗi tháng một lần vào tuần cuối của tháng.\n2. Tài liệu phiên họp được gửi đến các thành viên chậm nhất 03 ngày làm việc trước ngày họp qua Hệ thống phòng họp không giấy.\n3. Thành viên UBND tỉnh có trách nhiệm nghiên cứu tài liệu, cho ý kiến và biểu quyết các nội dung thuộc thẩm quyền.\nĐiều 13. Biểu quyết\n1. Nghị quyết của UBND tỉnh được thông qua khi có quá nửa tổng số thành viên biểu quyết tán thành.\n2. Kết quả biểu quyết được ghi nhận vào biên bản phiên họp và lưu trữ điện tử.`,
    chithi: `CHỈ THỊ SỐ 05/CT-TTg\nVề việc đẩy mạnh giải ngân vốn đầu tư công năm 2026\n(Tài liệu tham khảo — lưu hành nội bộ)\n\nThủ tướng Chính phủ yêu cầu các bộ, ngành, địa phương:\n1. Phấn đấu giải ngân trên 95% kế hoạch được giao; gắn trách nhiệm người đứng đầu.\n2. Rút ngắn tối thiểu 30% thời gian thẩm định dự án; xử lý nghiêm hành vi nhũng nhiễu.\n3. Báo cáo định kỳ hằng tháng về Bộ Kế hoạch và Đầu tư.`,
    giaingan: `BÁO CÁO CHUYÊN ĐỀ\nTình hình giải ngân vốn đầu tư công năm 2026\n\n1. Tổng kế hoạch vốn: 7.200 tỷ đồng; đã giải ngân 2.995 tỷ đồng (41,6%).\n2. 05 chủ đầu tư giải ngân dưới 25%: đề nghị kiểm điểm, làm rõ trách nhiệm.\n3. Đề xuất điều chuyển 120 tỷ đồng từ các dự án chậm tiến độ sang các dự án có khả năng hấp thụ vốn tốt.`,
    cds: `DỰ THẢO\nKẾ HOẠCH CHUYỂN ĐỔI SỐ TỈNH GIAI ĐOẠN 2026–2030\n\nMục tiêu đến năm 2030:\n- 100% thủ tục hành chính đủ điều kiện cung cấp trực tuyến toàn trình.\n- 100% cuộc họp của UBND tỉnh và các sở, ngành thực hiện trên hệ thống phòng họp không giấy.\n- Kinh tế số chiếm 25% GRDP; 90% người dân trưởng thành có danh tính số.\n- Hoàn thành Trung tâm dữ liệu tỉnh đạt chuẩn Tier III và nền tảng tích hợp, chia sẻ dữ liệu (LGSP) thế hệ mới.\n\nNhiệm vụ trọng tâm: phát triển hạ tầng số, dữ liệu số, nhân lực số; bảo đảm an toàn thông tin theo cấp độ; bố trí tối thiểu 1,5% chi ngân sách hằng năm cho chuyển đổi số.`,
    kt6: `BÁO CÁO\nTình hình kinh tế – xã hội tháng 6 và nhiệm vụ tháng 7 năm 2026\n\n1. Chỉ số sản xuất công nghiệp (IIP) tháng 6 tăng 11,2% so với cùng kỳ.\n2. Tổng mức bán lẻ hàng hóa và doanh thu dịch vụ đạt 8.420 tỷ đồng, tăng 10,5%.\n3. Nhiệm vụ tháng 7: hoàn thành báo cáo sơ kết 6 tháng; chuẩn bị kỳ họp HĐND tỉnh giữa năm.`,
    tsc: `DỰ THẢO\nQUY CHẾ QUẢN LÝ, SỬ DỤNG TÀI SẢN CÔNG TẠI CÁC CƠ QUAN, ĐƠN VỊ\n\nChương I. Quy định chung: phạm vi, đối tượng áp dụng, nguyên tắc quản lý.\nChương II. Tiêu chuẩn, định mức sử dụng trụ sở làm việc, xe ô tô công, máy móc thiết bị.\nChương III. Trình tự mua sắm, thuê, thu hồi, điều chuyển, thanh lý tài sản công.\nChương IV. Trách nhiệm của thủ trưởng cơ quan, đơn vị và chế độ báo cáo, công khai.`,
    ghichu: `GHI CHÚ CHUẨN BỊ Ý KIẾN CHỈ ĐẠO — PHIÊN HỌP THÁNG 7\n\n1. Biểu dương Sở KH&ĐT về kết quả thu hút đầu tư (12.450 tỷ đồng).\n2. Nhắc nhở tiến độ GPMB đường vành đai — yêu cầu cam kết mốc 15/8.\n3. Lưu ý cân đối vốn đợt 2: ưu tiên y tế cơ sở theo kiến nghị của Sở Y tế.\n4. Giao VP UBND tỉnh dự thảo Chỉ thị về tăng cường kỷ luật, kỷ cương hành chính.`,
    dscv: `DANH SÁCH CÔNG VIỆC CHUẨN BỊ PHIÊN HỌP THÁNG 7\n\n[x] Gửi giấy mời + tài liệu trước 03 ngày làm việc\n[x] Kiểm tra thiết bị phòng họp số 1, hệ thống điểm danh QR\n[x] Nạp tài liệu 04 nội dung lên hệ thống\n[ ] Chuẩn bị dự thảo Nghị quyết, biểu quyết điện tử\n[ ] Dự thảo biên bản, trình ký số ngay sau phiên họp`,
  };

  const D = (id: string, name: string, kind: 'main' | 'reference' | 'personal', ownerId: string, content: string, opts: Partial<Snapshot['documents'][0]> = {}) => ({
    id, name, kind, ownerId, content,
    meetingId: null, agendaItemId: null, sharedWith: [], dataUrl: undefined,
    size: content.length * 2, mime: 'application/pdf',
    uploadedAt: iso(minAgo(60 * 24 * 3)), secret: false, version: 1,
    ...opts,
  });

  const documents = [
    D('d1', 'Báo cáo KT-XH 6 tháng đầu năm 2026.pdf', 'main', 'u-khdt', docText.ktxh, { meetingId: 'm1', agendaItemId: 'a1' }),
    D('d2', 'Phụ lục số liệu KT-XH.pdf', 'main', 'u-khdt', docText.phuluc, { meetingId: 'm1', agendaItemId: 'a1' }),
    D('d3', 'Tờ trình phân bổ vốn đầu tư công đợt 2.pdf', 'main', 'u-tc', docText.totrinh, { meetingId: 'm1', agendaItemId: 'a2' }),
    D('d4', 'Báo cáo tiến độ đường vành đai phía Đông.pdf', 'main', 'u-gtvt', docText.vanhdai, { meetingId: 'm1', agendaItemId: 'a3' }),
    D('d5', 'Dự thảo Nghị quyết phiên họp tháng 7.pdf', 'main', 'u-tk', docText.nghiquyet, { meetingId: 'm1', agendaItemId: 'a4', version: 2 }),
    D('d-ref1', 'Quy chế làm việc của UBND tỉnh.pdf', 'reference', 'u-tk', docText.quyche, { meetingId: 'm1' }),
    D('d-ref2', 'Chỉ thị 05/CT-TTg về giải ngân ĐTC.pdf', 'reference', 'u-tk', docText.chithi, { meetingId: 'm1', secret: true }),
    D('d6', 'Báo cáo giải ngân vốn đầu tư công.pdf', 'main', 'u-khdt', docText.giaingan, { meetingId: 'm2', agendaItemId: 'a2-1' }),
    D('d7', 'Dự thảo Kế hoạch chuyển đổi số 2026-2030.pdf', 'main', 'u-tt', docText.cds, { meetingId: 'm3', agendaItemId: 'a3-1' }),
    D('d8', 'Báo cáo KT-XH tháng 6.2026.pdf', 'main', 'u-khdt', docText.kt6, { meetingId: 'm4', agendaItemId: 'a4-1' }),
    D('d9', 'Dự thảo Nghị quyết phiên họp tháng 6.pdf', 'main', 'u-tk', docText.nghiquyet.replace(/THÁNG 7/g, 'THÁNG 6'), { meetingId: 'm4', agendaItemId: 'a4-3' }),
    D('d10', 'Dự thảo Quy chế quản lý tài sản công.pdf', 'reference', 'u-tc', docText.tsc, {}),
    D('d-p1', 'Ghi chú chuẩn bị ý kiến chỉ đạo.docx', 'personal', 'u-ct', docText.ghichu, { sharedWith: ['u-tk'], mime: 'application/msword' }),
    D('d-p2', 'Danh sách công việc chuẩn bị phiên họp.docx', 'personal', 'u-tk', docText.dscv, { mime: 'application/msword' }),
  ] as Snapshot['documents'];

  // ---------------- Phiên họp ----------------
  const pAccepted = (userId: string, meetingRole: 'chair' | 'secretary' | 'member' | 'guest', seat?: string, checkedIn = true) => ({
    userId, meetingRole, attendStatus: 'accepted' as const, checkedInAt: checkedIn ? iso(minAgo(25 + Math.floor(Math.random() * 10))) : null, seat,
  });

  const meetings = [
    {
      id: 'm1', code: 'PH-2026/07-01',
      title: 'Phiên họp thường kỳ UBND tỉnh tháng 7/2026',
      description: 'Đánh giá tình hình KT-XH 6 tháng đầu năm 2026; phân bổ vốn đầu tư công đợt 2; tiến độ dự án trọng điểm; thông qua Nghị quyết phiên họp.',
      startTime: iso(minAgo(30)), endTime: iso(minFromNow(90)),
      roomId: 'r1', isOnline: true, status: 'live',
      chairId: 'u-ct', secretaryId: 'u-tk',
      participants: [
        pAccepted('u-ct', 'chair', 'Chủ tọa'),
        pAccepted('u-tk', 'secretary', 'Bàn thư ký'),
        pAccepted('u-pct', 'member', 'A1'),
        pAccepted('u-khdt', 'member', 'A2'),
        pAccepted('u-tc', 'member', 'A3'),
        { userId: 'u-xd', meetingRole: 'member' as const, attendStatus: 'delegated' as const, delegateToId: 'u-pxd', checkedInAt: null, seat: 'A4' },
        pAccepted('u-pxd', 'guest', 'A4'),
        pAccepted('u-tnmt', 'member', 'B1'),
        pAccepted('u-gtvt', 'member', 'B2'),
        pAccepted('u-yt', 'member', 'B3', false),
        pAccepted('u-gd', 'member', 'B4', false),
        pAccepted('u-tt', 'member', 'B5'),
      ],
      agenda: [
        { id: 'a1', order: 1, title: 'Báo cáo tình hình kinh tế – xã hội 6 tháng đầu năm 2026, nhiệm vụ trọng tâm 6 tháng cuối năm', presenterId: 'u-khdt', durationMinutes: 45, documentIds: ['d1', 'd2'] },
        { id: 'a2', order: 2, title: 'Tờ trình phân bổ kế hoạch vốn đầu tư công đợt 2 năm 2026', presenterId: 'u-tc', durationMinutes: 30, documentIds: ['d3'] },
        { id: 'a3', order: 3, title: 'Báo cáo tiến độ Dự án đường vành đai phía Đông', presenterId: 'u-gtvt', durationMinutes: 30, documentIds: ['d4'] },
        { id: 'a4', order: 4, title: 'Thảo luận, biểu quyết thông qua dự thảo Nghị quyết phiên họp', presenterId: 'u-tk', durationMinutes: 15, documentIds: ['d5'] },
      ],
      currentAgendaItemId: 'a2',
      // Phiên chất vấn đang mở để demo nghiệp vụ (E-HSMT mục 34/45/46)
      questionSession: 'open',
      conclusions: [
        { id: 'c1', content: 'Thông qua Báo cáo KT-XH 6 tháng đầu năm 2026. Giao Sở KH&ĐT hoàn thiện, trình HĐND tỉnh tại kỳ họp giữa năm. Biểu dương kết quả thu hút đầu tư 12.450 tỷ đồng.', agendaItemId: 'a1', createdAt: iso(minAgo(10)) },
      ],
      minutes: null,
      createdBy: 'u-tk', createdAt: iso(minAgo(60 * 24 * 5)), invitedAt: iso(minAgo(60 * 24 * 4)),
    },
    {
      id: 'm2', code: 'PH-2026/07-02',
      title: 'Họp chuyên đề về giải ngân vốn đầu tư công năm 2026',
      description: 'Rà soát tiến độ giải ngân của các chủ đầu tư; phương án điều chuyển vốn các dự án chậm tiến độ.',
      startTime: iso(dayAt(2, 8, 0)), endTime: iso(dayAt(2, 11, 30)),
      roomId: 'r1', isOnline: true, status: 'invited',
      chairId: 'u-pct', secretaryId: 'u-tk',
      participants: [
        { userId: 'u-pct', meetingRole: 'chair' as const, attendStatus: 'accepted' as const, checkedInAt: null },
        { userId: 'u-tk', meetingRole: 'secretary' as const, attendStatus: 'accepted' as const, checkedInAt: null },
        { userId: 'u-ct', meetingRole: 'member' as const, attendStatus: 'pending' as const, checkedInAt: null },
        { userId: 'u-khdt', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: null },
        { userId: 'u-tc', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: null },
        { userId: 'u-xd', meetingRole: 'member' as const, attendStatus: 'pending' as const, checkedInAt: null },
        { userId: 'u-gtvt', meetingRole: 'member' as const, attendStatus: 'pending' as const, checkedInAt: null },
      ],
      agenda: [
        { id: 'a2-1', order: 1, title: 'Báo cáo tổng hợp tình hình giải ngân của các chủ đầu tư', presenterId: 'u-khdt', durationMinutes: 40, documentIds: ['d6'] },
        { id: 'a2-2', order: 2, title: 'Thảo luận phương án điều chuyển 120 tỷ đồng vốn các dự án chậm tiến độ', presenterId: 'u-tc', durationMinutes: 50, documentIds: [] },
      ],
      currentAgendaItemId: null,
      conclusions: [], minutes: null,
      createdBy: 'u-tk', createdAt: iso(minAgo(60 * 24 * 2)), invitedAt: iso(minAgo(60 * 22)),
    },
    {
      id: 'm3', code: 'PH-2026/07-03',
      title: 'Họp Ban Chỉ đạo chuyển đổi số tỉnh quý III/2026',
      description: 'Cho ý kiến dự thảo Kế hoạch chuyển đổi số giai đoạn 2026–2030; sơ kết hoạt động quý II.',
      startTime: iso(dayAt(7, 14, 0)), endTime: iso(dayAt(7, 16, 30)),
      roomId: 'r3', isOnline: true, status: 'draft',
      chairId: 'u-ct', secretaryId: 'u-tk',
      participants: [
        { userId: 'u-ct', meetingRole: 'chair' as const, attendStatus: 'pending' as const, checkedInAt: null },
        { userId: 'u-tk', meetingRole: 'secretary' as const, attendStatus: 'pending' as const, checkedInAt: null },
        { userId: 'u-tt', meetingRole: 'member' as const, attendStatus: 'pending' as const, checkedInAt: null },
        { userId: 'u-gd', meetingRole: 'member' as const, attendStatus: 'pending' as const, checkedInAt: null },
        { userId: 'u-yt', meetingRole: 'member' as const, attendStatus: 'pending' as const, checkedInAt: null },
        { userId: 'u-khdt', meetingRole: 'member' as const, attendStatus: 'pending' as const, checkedInAt: null },
      ],
      agenda: [
        { id: 'a3-1', order: 1, title: 'Dự thảo Kế hoạch chuyển đổi số tỉnh giai đoạn 2026–2030', presenterId: 'u-tt', durationMinutes: 60, documentIds: ['d7'] },
        { id: 'a3-2', order: 2, title: 'Sơ kết hoạt động Ban Chỉ đạo quý II/2026', presenterId: 'u-tk', durationMinutes: 30, documentIds: [] },
      ],
      currentAgendaItemId: null,
      conclusions: [], minutes: null,
      createdBy: 'u-tk', createdAt: iso(minAgo(60 * 10)),
    },
    {
      id: 'm4', code: 'PH-2026/06-01',
      title: 'Phiên họp thường kỳ UBND tỉnh tháng 6/2026',
      description: 'Đánh giá tình hình KT-XH tháng 6; chuẩn bị kỳ họp HĐND tỉnh giữa năm 2026.',
      startTime: iso(dayAt(-18, 8, 0)), endTime: iso(dayAt(-18, 11, 30)),
      roomId: 'r1', isOnline: false, status: 'finished',
      documentNumber: 'Số: 06/BB-UBND', documentLocation: '………',
      chairId: 'u-ct', secretaryId: 'u-tk',
      participants: [
        { userId: 'u-ct', meetingRole: 'chair' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 45)), seat: 'Chủ tọa' },
        { userId: 'u-tk', meetingRole: 'secretary' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 40)), seat: 'Bàn thư ký' },
        { userId: 'u-pct', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 50)), seat: 'A1' },
        { userId: 'u-khdt', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 52)), seat: 'A2' },
        { userId: 'u-tc', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 55)), seat: 'A3' },
        { userId: 'u-tnmt', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 58)), seat: 'B1' },
        { userId: 'u-gtvt', meetingRole: 'member' as const, attendStatus: 'declined' as const, declineReason: 'Tham gia đoàn công tác của Bộ GTVT', checkedInAt: null, seat: 'B2' },
        { userId: 'u-yt', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 8, 2)), seat: 'B3' },
        { userId: 'u-gd', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 57)), seat: 'B4' },
        { userId: 'u-tt', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-18, 7, 59)), seat: 'B5' },
      ],
      agenda: [
        { id: 'a4-1', order: 1, title: 'Báo cáo tình hình KT-XH tháng 6, nhiệm vụ tháng 7/2026', presenterId: 'u-khdt', durationMinutes: 40, documentIds: ['d8'] },
        { id: 'a4-2', order: 2, title: 'Công tác chuẩn bị kỳ họp HĐND tỉnh giữa năm 2026', presenterId: 'u-tk', durationMinutes: 30, documentIds: [] },
        { id: 'a4-3', order: 3, title: 'Thông qua Nghị quyết phiên họp', presenterId: 'u-tk', durationMinutes: 15, documentIds: ['d9'] },
      ],
      currentAgendaItemId: null,
      conclusions: [
        { id: 'c4-1', content: 'Thông qua Báo cáo KT-XH tháng 6/2026. Yêu cầu các sở, ngành hoàn thành báo cáo sơ kết 6 tháng trước ngày 05/7/2026.', agendaItemId: 'a4-1', createdAt: iso(dayAt(-18, 9, 30)) },
        { id: 'c4-2', content: 'Giao Văn phòng UBND tỉnh phối hợp Văn phòng HĐND tỉnh chuẩn bị chu đáo nội dung, tài liệu kỳ họp HĐND tỉnh giữa năm.', agendaItemId: 'a4-2', createdAt: iso(dayAt(-18, 10, 15)) },
        { id: 'c4-3', content: 'Thống nhất thông qua Nghị quyết phiên họp với 9/9 thành viên dự họp tán thành.', agendaItemId: 'a4-3', createdAt: iso(dayAt(-18, 11, 10)) },
      ],
      minutes: {
        content: `BIÊN BẢN PHIÊN HỌP THƯỜNG KỲ UBND TỈNH THÁNG 6/2026\n\nThời gian: 08h00 – 11h30\nĐịa điểm: Phòng họp số 1, Trụ sở UBND tỉnh\nChủ trì: Đ/c Trần Đại Nghĩa — Chủ tịch UBND tỉnh\nThư ký: Đ/c Phạm Văn Thư — Chánh Văn phòng UBND tỉnh\nThành phần: 09/10 thành viên dự họp (vắng: Đ/c Bùi Đức Long — có lý do)\n\nI. NỘI DUNG\n1. Sở KH&ĐT báo cáo tình hình KT-XH tháng 6: IIP tăng 11,2%; tổng mức bán lẻ tăng 10,5%.\n2. Văn phòng UBND tỉnh báo cáo công tác chuẩn bị kỳ họp HĐND tỉnh giữa năm 2026.\n3. Phiên họp đã biểu quyết thông qua Nghị quyết với 9/9 thành viên dự họp tán thành.\n\nII. KẾT LUẬN CỦA CHỦ TỌA\n(1) Thông qua Báo cáo KT-XH tháng 6/2026; các sở, ngành hoàn thành báo cáo sơ kết 6 tháng trước 05/7/2026.\n(2) Giao Văn phòng UBND tỉnh chuẩn bị nội dung kỳ họp HĐND tỉnh.\n(3) Thông qua Nghị quyết phiên họp.\n\nBiên bản được lập và ký số trên Hệ thống phòng họp không giấy eCabinet.`,
        updatedAt: iso(dayAt(-18, 11, 25)),
        signatures: [
          { signerId: 'u-tk', signerName: 'Phạm Văn Thư', signerTitle: 'Chánh Văn phòng UBND tỉnh — Thư ký', signedAt: iso(dayAt(-18, 11, 26)), serial: 'VN-DEMO-CA:5401:2f8e19', hash: '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7' },
          { signerId: 'u-ct', signerName: 'Trần Đại Nghĩa', signerTitle: 'Chủ tịch UBND tỉnh — Chủ trì', signedAt: iso(dayAt(-18, 11, 28)), serial: 'VN-DEMO-CA:5402:8ac310', hash: '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7' },
        ],
        locked: true,
      },
      createdBy: 'u-tk', createdAt: iso(dayAt(-25, 9, 0)), invitedAt: iso(dayAt(-22, 9, 0)),
    },
    {
      id: 'm5', code: 'GB-2026/06-02',
      title: 'Họp giao ban công tác cải cách hành chính',
      description: 'Đánh giá kết quả Chỉ số PAR INDEX; giải pháp nâng cao tỷ lệ hồ sơ trực tuyến toàn trình.',
      startTime: iso(dayAt(-35, 14, 0)), endTime: iso(dayAt(-35, 16, 0)),
      roomId: 'r3', isOnline: true, status: 'finished',
      chairId: 'u-pct', secretaryId: 'u-tk',
      participants: [
        { userId: 'u-pct', meetingRole: 'chair' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-35, 13, 50)) },
        { userId: 'u-tk', meetingRole: 'secretary' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-35, 13, 48)) },
        { userId: 'u-tt', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-35, 13, 55)) },
        { userId: 'u-gd', meetingRole: 'member' as const, attendStatus: 'accepted' as const, checkedInAt: iso(dayAt(-35, 13, 57)) },
      ],
      agenda: [
        { id: 'a5-1', order: 1, title: 'Kết quả Chỉ số cải cách hành chính năm 2025 và giải pháp', presenterId: 'u-tt', durationMinutes: 45, documentIds: [] },
      ],
      currentAgendaItemId: null,
      conclusions: [
        { id: 'c5-1', content: 'Các sở, ngành xây dựng kế hoạch khắc phục các tiêu chí thành phần đạt thấp; hoàn thành trước 30/7/2026.', agendaItemId: 'a5-1', createdAt: iso(dayAt(-35, 15, 40)) },
      ],
      minutes: {
        content: 'BIÊN BẢN HỌP GIAO BAN CÔNG TÁC CẢI CÁCH HÀNH CHÍNH\n\nHội nghị thống nhất các giải pháp nâng cao Chỉ số PAR INDEX; giao Sở TT&TT theo dõi, đôn đốc.',
        updatedAt: iso(dayAt(-35, 16, 5)),
        signatures: [],
        locked: false,
      },
      createdBy: 'u-tk', createdAt: iso(dayAt(-40, 9, 0)), invitedAt: iso(dayAt(-38, 9, 0)),
    },
  ] as Snapshot['meetings'];

  // ---------------- Biểu quyết & Lấy ý kiến ----------------
  const OPT3 = [
    { id: 'o1', label: 'Đồng ý' },
    { id: 'o2', label: 'Không đồng ý' },
    { id: 'o3', label: 'Ý kiến khác' },
  ];
  const OPT_POLL = [
    { id: 'p1', label: 'Nhất trí' },
    { id: 'p2', label: 'Nhất trí, có chỉnh sửa bổ sung' },
    { id: 'p3', label: 'Không nhất trí' },
  ];
  const memberIds = ['u-ct', 'u-pct', 'u-khdt', 'u-tc', 'u-tnmt', 'u-gtvt', 'u-yt', 'u-gd', 'u-tt', 'u-pxd'];

  const votes = [
    {
      id: 'v1', kind: 'vote', meetingId: 'm1', agendaItemId: 'a1',
      title: 'Thông qua Báo cáo tình hình KT-XH 6 tháng đầu năm 2026',
      description: 'Biểu quyết thông qua nội dung Báo cáo do Sở KH&ĐT trình bày.',
      options: OPT3, secret: false, status: 'closed', documentIds: ['d1'],
      passThreshold: 'majority', approveOptionId: 'o1', abstainOptionId: 'o3',
      eligibleIds: memberIds,
      ballots: [
        { userId: 'u-ct', optionId: 'o1', castAt: iso(minAgo(18)) },
        { userId: 'u-pct', optionId: 'o1', castAt: iso(minAgo(18)) },
        { userId: 'u-khdt', optionId: 'o1', castAt: iso(minAgo(17)) },
        { userId: 'u-tc', optionId: 'o1', castAt: iso(minAgo(17)) },
        { userId: 'u-tnmt', optionId: 'o1', castAt: iso(minAgo(17)) },
        { userId: 'u-gtvt', optionId: 'o1', castAt: iso(minAgo(16)) },
        { userId: 'u-gd', optionId: 'o3', comment: 'Đề nghị bổ sung số liệu về giáo dục nghề nghiệp.', castAt: iso(minAgo(16)) },
        { userId: 'u-tt', optionId: 'o1', castAt: iso(minAgo(15)) },
        { userId: 'u-pxd', optionId: 'o1', castAt: iso(minAgo(15)) },
      ],
      createdBy: 'u-tk', createdAt: iso(minAgo(60 * 24)), openedAt: iso(minAgo(19)), closedAt: iso(minAgo(13)),
    },
    {
      id: 'v2', kind: 'vote', meetingId: 'm1', agendaItemId: 'a2',
      title: 'Thông qua chủ trương phân bổ 850 tỷ đồng vốn đầu tư công đợt 2 năm 2026',
      description: 'Theo phương án tại Tờ trình của Sở Tài chính.',
      options: OPT3, secret: false, status: 'open', documentIds: ['d3'],
      passThreshold: 'majority', approveOptionId: 'o1', abstainOptionId: 'o3',
      eligibleIds: memberIds,
      ballots: [
        { userId: 'u-pct', optionId: 'o1', castAt: iso(minAgo(2)) },
        { userId: 'u-khdt', optionId: 'o1', castAt: iso(minAgo(2)) },
        { userId: 'u-tc', optionId: 'o1', castAt: iso(minAgo(1)) },
        { userId: 'u-tnmt', optionId: 'o3', comment: 'Đề nghị tăng vốn cho xử lý rác thải sinh hoạt.', castAt: iso(minAgo(1)) },
      ],
      createdBy: 'u-tk', createdAt: iso(minAgo(60 * 24)), openedAt: iso(minAgo(3)),
    },
    {
      id: 'v3', kind: 'vote', meetingId: 'm1', agendaItemId: 'a4',
      title: 'Thông qua dự thảo Nghị quyết phiên họp thường kỳ tháng 7/2026',
      description: 'Biểu quyết thông qua toàn văn dự thảo Nghị quyết.',
      options: OPT3, secret: false, status: 'pending', documentIds: ['d5'],
      passThreshold: 'majority', approveOptionId: 'o1', abstainOptionId: 'o3',
      eligibleIds: memberIds, ballots: [],
      createdBy: 'u-tk', createdAt: iso(minAgo(60 * 24)),
    },
    {
      id: 'v4', kind: 'vote', meetingId: 'm4', agendaItemId: 'a4-3',
      title: 'Thông qua Nghị quyết phiên họp thường kỳ tháng 6/2026',
      options: OPT3, secret: false, status: 'closed', documentIds: ['d9'],
      passThreshold: 'majority', approveOptionId: 'o1', abstainOptionId: 'o3',
      eligibleIds: memberIds.filter((x) => x !== 'u-gtvt' && x !== 'u-pxd'),
      ballots: ['u-ct', 'u-pct', 'u-khdt', 'u-tc', 'u-tnmt', 'u-yt', 'u-gd', 'u-tt'].map((uidX, i) => ({ userId: uidX, optionId: 'o1', castAt: iso(dayAt(-18, 11, i)) })),
      createdBy: 'u-tk', createdAt: iso(dayAt(-19, 9, 0)), openedAt: iso(dayAt(-18, 11, 0)), closedAt: iso(dayAt(-18, 11, 9)),
    },
    {
      id: 'p-cds', kind: 'poll', meetingId: null, agendaItemId: null,
      title: 'Lấy ý kiến dự thảo Kế hoạch chuyển đổi số tỉnh giai đoạn 2026–2030',
      description: 'Đề nghị các đồng chí thành viên UBND tỉnh nghiên cứu, cho ý kiến trước khi trình phiên họp Ban Chỉ đạo.',
      options: OPT_POLL, secret: false, status: 'open', deadline: iso(dayAt(3, 17, 0)), documentIds: ['d7'],
      passThreshold: 'majority', approveOptionId: 'p1',
      eligibleIds: memberIds.filter((x) => x !== 'u-pxd'),
      ballots: [
        { userId: 'u-tt', optionId: 'p1', comment: 'Cơ quan soạn thảo đã tiếp thu ý kiến các ngành.', castAt: iso(minAgo(60 * 20)) },
        { userId: 'u-khdt', optionId: 'p2', comment: 'Bổ sung danh mục dự án ưu tiên kèm khái toán vốn.', castAt: iso(minAgo(60 * 15)) },
        { userId: 'u-gd', optionId: 'p1', castAt: iso(minAgo(60 * 12)) },
        { userId: 'u-yt', optionId: 'p2', comment: 'Làm rõ lộ trình bệnh án điện tử tại các bệnh viện tuyến huyện.', castAt: iso(minAgo(60 * 8)) },
        { userId: 'u-tc', optionId: 'p1', castAt: iso(minAgo(60 * 5)) },
      ],
      createdBy: 'u-tk', createdAt: iso(minAgo(60 * 26)), openedAt: iso(minAgo(60 * 26)),
    },
    {
      id: 'p-tsc', kind: 'poll', meetingId: null, agendaItemId: null,
      title: 'Lấy ý kiến dự thảo Quy chế quản lý, sử dụng tài sản công',
      description: 'Xin ý kiến trước khi ban hành Quyết định của UBND tỉnh.',
      options: OPT_POLL, secret: false, status: 'closed', deadline: iso(dayAt(-5, 17, 0)), documentIds: ['d10'],
      passThreshold: 'majority', approveOptionId: 'p1',
      eligibleIds: memberIds.filter((x) => x !== 'u-pxd'),
      ballots: [
        { userId: 'u-ct', optionId: 'p1', castAt: iso(dayAt(-7, 9, 0)) },
        { userId: 'u-pct', optionId: 'p1', castAt: iso(dayAt(-7, 10, 0)) },
        { userId: 'u-khdt', optionId: 'p1', castAt: iso(dayAt(-6, 14, 0)) },
        { userId: 'u-tc', optionId: 'p1', castAt: iso(dayAt(-6, 15, 0)) },
        { userId: 'u-tnmt', optionId: 'p2', comment: 'Bổ sung định mức thiết bị quan trắc môi trường.', castAt: iso(dayAt(-6, 16, 0)) },
        { userId: 'u-gtvt', optionId: 'p1', castAt: iso(dayAt(-5, 9, 0)) },
        { userId: 'u-yt', optionId: 'p1', castAt: iso(dayAt(-5, 10, 0)) },
        { userId: 'u-gd', optionId: 'p1', castAt: iso(dayAt(-5, 11, 0)) },
        { userId: 'u-tt', optionId: 'p1', castAt: iso(dayAt(-5, 14, 0)) },
      ],
      createdBy: 'u-tc', createdAt: iso(dayAt(-12, 9, 0)), openedAt: iso(dayAt(-12, 9, 0)), closedAt: iso(dayAt(-5, 17, 0)),
    },
  ] as Snapshot['votes'];

  // ---------------- Đăng ký phát biểu (m1) ----------------
  const speakRequests = [
    { id: 'sr0', meetingId: 'm1', userId: 'u-khdt', topic: 'Trình bày Báo cáo KT-XH', status: 'done', requestedAt: iso(minAgo(28)), startedAt: iso(minAgo(27)), endedAt: iso(minAgo(14)) },
    { id: 'sr1', meetingId: 'm1', userId: 'u-tc', topic: 'Giải trình cơ cấu nguồn vốn đợt 2', status: 'speaking', requestedAt: iso(minAgo(6)), startedAt: iso(minAgo(3)) },
    { id: 'sr2', meetingId: 'm1', userId: 'u-tnmt', topic: 'Kiến nghị bổ sung vốn xử lý rác thải', status: 'waiting', requestedAt: iso(minAgo(4)) },
    { id: 'sr3', meetingId: 'm1', userId: 'u-gtvt', topic: 'Tiến độ GPMB đường vành đai', status: 'waiting', requestedAt: iso(minAgo(2)) },
  ] as Snapshot['speakRequests'];

  // ---------------- Đăng ký chất vấn (m1) ----------------
  const questions = [
    // 1 lượt đã chất vấn xong (đã gọi)
    { id: 'q0', meetingId: 'm1', userId: 'u-tnmt', targetName: 'Sở Giao thông vận tải', topic: 'Trách nhiệm chậm giải phóng mặt bằng đường vành đai phía Đông', content: 'Đề nghị Sở GTVT làm rõ nguyên nhân chậm GPMB và cam kết mốc hoàn thành cụ thể.', status: 'done', order: 1, createdAt: iso(minAgo(20)), calledAt: iso(minAgo(18)), endedAt: iso(minAgo(12)) },
    // 1 lượt đang chờ gọi (chưa gọi)
    { id: 'q1', meetingId: 'm1', userId: 'u-yt', targetName: 'Sở Tài chính', topic: 'Bố trí vốn cho y tế cơ sở trong phương án phân bổ đợt 2', content: 'Vì sao tỷ trọng vốn cho y tế tuyến huyện còn thấp so với nhu cầu thực tế?', status: 'pending', order: 2, createdAt: iso(minAgo(5)) },
    // 1 lượt đang chờ gọi thứ hai
    { id: 'q2', meetingId: 'm1', userId: 'u-gd', targetName: 'Sở Kế hoạch và Đầu tư', topic: 'Tiến độ giải ngân vốn cho các dự án trường học', status: 'pending', order: 3, createdAt: iso(minAgo(3)) },
  ] as Snapshot['questions'];

  // ---------------- Trao đổi (m1) ----------------
  const messages = [
    { id: 'msg1', meetingId: 'm1', fromId: 'u-tk', toId: null, content: 'Kính gửi các đại biểu: tài liệu mục 2 (Tờ trình phân bổ vốn) đã được cập nhật phiên bản mới.', sentAt: iso(minAgo(12)) },
    { id: 'msg2', meetingId: 'm1', fromId: 'u-khdt', toId: null, content: 'Đề nghị Sở Tài chính làm rõ thêm cơ cấu nguồn vốn đối ứng của các dự án y tế.', sentAt: iso(minAgo(9)) },
    { id: 'msg3', meetingId: 'm1', fromId: 'u-tc', toId: null, content: 'Tôi sẽ giải trình nội dung này trong phần phát biểu tiếp theo.', sentAt: iso(minAgo(8)) },
    { id: 'msg4', meetingId: 'm1', fromId: 'u-ct', toId: 'u-tk', content: 'Đồng chí chuẩn bị dự thảo kết luận mục 2 theo hướng thống nhất phương án, lưu ý kiến nghị của Sở TN&MT.', sentAt: iso(minAgo(5)) },
    { id: 'msg5', meetingId: 'm1', fromId: 'u-tk', toId: 'u-ct', content: 'Dạ vâng, em đã dự thảo và chia sẻ vào tài liệu cá nhân của đồng chí.', sentAt: iso(minAgo(4)) },
  ] as Snapshot['messages'];

  // ---------------- Nhiệm vụ sau họp ----------------
  const tasks = [
    { id: 't1', meetingId: 'm4', title: 'Hoàn thiện báo cáo sơ kết 6 tháng của các sở, ngành', description: 'Theo Kết luận số 1 phiên họp tháng 6/2026.', assigneeId: 'u-khdt', deadline: iso(dayAt(-9, 17, 0)), status: 'done', progress: 100, createdAt: iso(dayAt(-18, 12, 0)), updatedAt: iso(dayAt(-10, 9, 0)) },
    { id: 't2', meetingId: 'm4', title: 'Chuẩn bị nội dung, tài liệu kỳ họp HĐND tỉnh giữa năm', description: 'Phối hợp Văn phòng HĐND tỉnh; hoàn thành trước khai mạc 07 ngày.', assigneeId: 'u-tk', deadline: iso(dayAt(6, 17, 0)), status: 'doing', progress: 70, createdAt: iso(dayAt(-18, 12, 0)), updatedAt: iso(minAgo(60 * 30)) },
    { id: 't3', meetingId: 'm1', title: 'Hoàn thành GPMB Dự án đường vành đai phía Đông', description: 'Bàn giao 100% mặt bằng trước 15/8/2026 theo kết luận chủ tọa.', assigneeId: 'u-tnmt', deadline: iso(dayAt(32, 17, 0)), status: 'doing', progress: 35, createdAt: iso(minAgo(9)), updatedAt: iso(minAgo(9)) },
    { id: 't4', meetingId: 'm5', title: 'Kế hoạch khắc phục tiêu chí PAR INDEX đạt thấp', description: 'Các sở, ngành gửi kế hoạch về Sở TT&TT tổng hợp.', assigneeId: 'u-tt', deadline: iso(dayAt(16, 17, 0)), status: 'open', progress: 0, createdAt: iso(dayAt(-35, 16, 0)), updatedAt: iso(dayAt(-35, 16, 0)) },
    { id: 't5', meetingId: null, title: 'Dự thảo Chỉ thị về kỷ luật, kỷ cương hành chính', description: 'Theo chỉ đạo của Chủ tịch UBND tỉnh.', assigneeId: 'u-tk', deadline: iso(dayAt(10, 17, 0)), status: 'open', progress: 10, createdAt: iso(minAgo(60 * 24)), updatedAt: iso(minAgo(60 * 24)) },
  ] as Snapshot['tasks'];

  // ---------------- Thông báo ----------------
  const notifications = [
    { id: 'n1', userId: 'u-ct', title: 'Giấy mời họp', body: 'Bạn được mời dự "Họp chuyên đề về giải ngân vốn đầu tư công năm 2026". Vui lòng xác nhận tham dự.', type: 'meeting', read: false, createdAt: iso(minAgo(60 * 22)), link: '#/meetings/m2' },
    { id: 'n2', userId: 'u-ct', title: 'Biểu quyết đang mở', body: 'Biểu quyết "Thông qua chủ trương phân bổ 850 tỷ đồng..." đang chờ ý kiến của bạn.', type: 'vote', read: false, createdAt: iso(minAgo(3)), link: '#/meetings/m1/live' },
    { id: 'n3', userId: 'u-ct', title: 'Phiếu lấy ý kiến', body: 'Đề nghị cho ý kiến dự thảo Kế hoạch chuyển đổi số 2026–2030 trước 17h00 ' + dayAt(3, 17).toLocaleDateString('vi-VN') + '.', type: 'poll', read: false, createdAt: iso(minAgo(60 * 26)), link: '#/polls' },
    { id: 'n4', userId: 'u-ct', title: 'Tài liệu được chia sẻ', body: 'Đ/c Phạm Văn Thư đã chia sẻ dự thảo kết luận vào tài liệu cá nhân của bạn.', type: 'doc', read: true, createdAt: iso(minAgo(4)), link: '#/documents' },
    { id: 'n5', userId: 'u-tk', title: 'Nhiệm vụ sắp đến hạn', body: 'Nhiệm vụ "Chuẩn bị nội dung, tài liệu kỳ họp HĐND tỉnh giữa năm" đến hạn trong 6 ngày.', type: 'task', read: false, createdAt: iso(minAgo(60 * 5)), link: '#/tasks' },
    { id: 'n6', userId: 'u-khdt', title: 'Giấy mời họp', body: 'Bạn được mời dự "Họp chuyên đề về giải ngân vốn đầu tư công năm 2026".', type: 'meeting', read: true, createdAt: iso(minAgo(60 * 22)), link: '#/meetings/m2' },
    { id: 'n7', userId: 'u-tnmt', title: 'Nhiệm vụ mới', body: 'Bạn được giao nhiệm vụ "Hoàn thành GPMB Dự án đường vành đai phía Đông" — hạn 15/8/2026.', type: 'task', read: false, createdAt: iso(minAgo(9)), link: '#/tasks' },
  ] as Snapshot['notifications'];

  // ---------------- Nhật ký hệ thống ----------------
  const audit = [
    { id: 'au1', userId: 'u-tk', userName: 'Phạm Văn Thư', action: 'Tạo phiên họp', detail: 'Tạo phiên họp "Họp chuyên đề về giải ngân vốn đầu tư công năm 2026" (PH-2026/07-02)', at: iso(minAgo(60 * 24 * 2)) },
    { id: 'au2', userId: 'u-tk', userName: 'Phạm Văn Thư', action: 'Gửi giấy mời', detail: 'Gửi giấy mời phiên họp PH-2026/07-02 đến 7 đại biểu (email + SMS)', at: iso(minAgo(60 * 22)) },
    { id: 'au3', userId: 'u-tk', userName: 'Phạm Văn Thư', action: 'Cập nhật tài liệu', detail: 'Cập nhật phiên bản 2 tài liệu "Dự thảo Nghị quyết phiên họp tháng 7.pdf"', at: iso(minAgo(60 * 3)) },
    { id: 'au4', userId: 'u-ct', userName: 'Trần Đại Nghĩa', action: 'Bắt đầu phiên họp', detail: 'Khai mạc phiên họp thường kỳ UBND tỉnh tháng 7/2026', at: iso(minAgo(30)) },
    { id: 'au5', userId: 'u-tk', userName: 'Phạm Văn Thư', action: 'Mở biểu quyết', detail: 'Mở biểu quyết "Thông qua chủ trương phân bổ 850 tỷ đồng vốn đầu tư công đợt 2"', at: iso(minAgo(3)) },
    { id: 'au6', userId: 'u-ct', userName: 'Trần Đại Nghĩa', action: 'Ký số biên bản', detail: 'Ký số biên bản phiên họp tháng 6/2026 (serial VN-DEMO-CA:5402)', at: iso(dayAt(-18, 11, 28)) },
    { id: 'au7', userId: 'u-admin', userName: 'Đỗ Quang Trị', action: 'Đăng nhập', detail: 'Đăng nhập hệ thống từ địa chỉ 10.0.12.5', at: iso(minAgo(60 * 2)) },
  ] as Snapshot['audit'];

  return {
    users, units, rooms, meetings, documents,
    annotations: [
      { id: 'an1', docId: 'd3', userId: 'u-ct', content: 'Lưu ý: cân nhắc tăng tỷ trọng cho y tế cơ sở theo kiến nghị Sở Y tế.', createdAt: iso(minAgo(7)) },
      { id: 'an2', docId: 'd1', userId: 'u-ct', content: 'Số liệu thu hút đầu tư tốt — biểu dương tại phần kết luận.', createdAt: iso(minAgo(20)) },
      { id: 'an3', docId: 'd3', userId: 'u-khdt', content: 'Đề nghị bổ sung phụ lục chi tiết danh mục dự án kèm mức vốn của từng dự án.', isPublic: true, createdAt: iso(minAgo(11)) },
      { id: 'an4', docId: 'd3', userId: 'u-yt', content: 'Thống nhất phương án; đề nghị ưu tiên giải ngân sớm cho 02 bệnh viện tuyến huyện.', isPublic: true, createdAt: iso(minAgo(6)) },
      { id: 'an5', docId: 'd1', userId: 'u-gd', content: 'Đề nghị bổ sung số liệu về giáo dục nghề nghiệp vào mục I.4.', isPublic: true, createdAt: iso(minAgo(16)) },
    ],
    votes, speakRequests, questions, messages, tasks, notifications, audit,
  };
}

// ============================================================
// DANH MỤC MÔ TẢ API MỞ + OPENAPI 3.0 (E-HSMT mục 54–59, "quản lý mô tả API")
// - CATALOG: mảng mô tả 6+2 endpoint dùng CHUNG cho: sinh OpenAPI spec (/spec)
//   và trang quản trị "Danh mục API".
// - buildOpenApiSpec(): object OpenAPI 3.0 TỰ SINH từ CATALOG + securitySchemes.
//
// LƯU Ý ĐỒNG BỘ: bản sao TypeScript cho UI nằm ở src/domain/apiCatalog.ts —
// khi sửa CATALOG ở đây PHẢI đồng bộ tay sang đó (2 môi trường build khác nhau:
// server chạy .js trực tiếp, client bundle .ts).
// ============================================================

/** Phiên bản bộ API mở (đặt trong path /api/open/v1/...). */
export const OPEN_API_VERSION = 'v1';
export const SERVICE_NAME = 'ecabinet-open-api';

/**
 * Mỗi mục:
 *  id        : định danh nội bộ
 *  method    : phương thức HTTP
 *  path      : đường dẫn (có {tham số})
 *  summary   : tóm tắt ngắn (tiếng Việt)
 *  description: mô tả chi tiết
 *  params    : [{ name, in ('path'|'query'), required, type, description }]
 *  scope     : quyền bắt buộc ('meetings' | 'documents' | null nếu công khai)
 *  hsmtItem  : số mục E-HSMT tương ứng
 */
export const CATALOG = [
  {
    id: 'unit-meetings-upcoming',
    method: 'GET',
    path: '/api/open/v1/units/{unitId}/meetings/upcoming',
    summary: 'Danh sách cuộc họp của đơn vị sắp diễn ra',
    description: 'Trả về các cuộc họp SẮP hoặc ĐANG diễn ra mà đơn vị chủ trì hoặc có thành phần tham dự thuộc đơn vị. Sắp xếp theo thời gian bắt đầu tăng dần. Có phân trang.',
    params: [
      { name: 'unitId', in: 'path', required: true, type: 'string', description: 'Mã đơn vị' },
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Trang (mặc định 1)' },
      { name: 'size', in: 'query', required: false, type: 'integer', description: 'Số bản ghi/trang (mặc định 20, tối đa 100)' },
    ],
    scope: 'meetings',
    hsmtItem: 54,
  },
  {
    id: 'user-meetings-upcoming',
    method: 'GET',
    path: '/api/open/v1/users/{userId}/meetings/upcoming',
    summary: 'Danh sách cuộc họp của cá nhân sắp diễn ra',
    description: 'Trả về các cuộc họp SẮP hoặc ĐANG diễn ra mà cá nhân (userId) là thành phần tham dự. Sắp xếp theo thời gian bắt đầu tăng dần. Có phân trang.',
    params: [
      { name: 'userId', in: 'path', required: true, type: 'string', description: 'Mã người dùng' },
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Trang (mặc định 1)' },
      { name: 'size', in: 'query', required: false, type: 'integer', description: 'Số bản ghi/trang (mặc định 20, tối đa 100)' },
    ],
    scope: 'meetings',
    hsmtItem: 55,
  },
  {
    id: 'unit-meetings-past',
    method: 'GET',
    path: '/api/open/v1/units/{unitId}/meetings/past',
    summary: 'Danh sách cuộc họp của đơn vị đã diễn ra',
    description: 'Trả về các cuộc họp ĐÃ kết thúc (hoặc đã qua thời gian) mà đơn vị chủ trì hoặc có thành phần tham dự thuộc đơn vị. Sắp xếp theo thời gian bắt đầu giảm dần (mới nhất trước). Có phân trang.',
    params: [
      { name: 'unitId', in: 'path', required: true, type: 'string', description: 'Mã đơn vị' },
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Trang (mặc định 1)' },
      { name: 'size', in: 'query', required: false, type: 'integer', description: 'Số bản ghi/trang (mặc định 20, tối đa 100)' },
    ],
    scope: 'meetings',
    hsmtItem: 56,
  },
  {
    id: 'user-meetings-past',
    method: 'GET',
    path: '/api/open/v1/users/{userId}/meetings/past',
    summary: 'Danh sách cuộc họp của cá nhân đã diễn ra',
    description: 'Trả về các cuộc họp ĐÃ kết thúc (hoặc đã qua thời gian) mà cá nhân (userId) là thành phần tham dự. Sắp xếp theo thời gian bắt đầu giảm dần (mới nhất trước). Có phân trang.',
    params: [
      { name: 'userId', in: 'path', required: true, type: 'string', description: 'Mã người dùng' },
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Trang (mặc định 1)' },
      { name: 'size', in: 'query', required: false, type: 'integer', description: 'Số bản ghi/trang (mặc định 20, tối đa 100)' },
    ],
    scope: 'meetings',
    hsmtItem: 57,
  },
  {
    id: 'meeting-detail',
    method: 'GET',
    path: '/api/open/v1/meetings/{id}',
    summary: 'Lấy thông tin cuộc họp',
    description: 'Thông tin đầy đủ của 1 cuộc họp: metadata + chương trình (agenda) + thành phần tham dự + thống kê biểu quyết tổng hợp. KHÔNG kèm biên bản, kết luận chi tiết hay phiếu biểu quyết cá nhân (dữ liệu nghị sự nhạy cảm).',
    params: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Mã cuộc họp' },
    ],
    scope: 'meetings',
    hsmtItem: 58,
  },
  {
    id: 'meeting-documents',
    method: 'GET',
    path: '/api/open/v1/meetings/{id}/documents',
    summary: 'Danh sách tài liệu cuộc họp',
    description: 'Danh sách tài liệu ĐÃ DUYỆT và KHÔNG MẬT của cuộc họp. Trả metadata + contentUrl để tải nội dung. Yêu cầu quyền (scope) "documents".',
    params: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Mã cuộc họp' },
    ],
    scope: 'documents',
    hsmtItem: 59,
  },
  {
    id: 'document-content',
    method: 'GET',
    path: '/api/open/v1/documents/{id}/content',
    summary: 'Tải nội dung tài liệu',
    description: 'Trả nội dung 1 tài liệu ĐÃ DUYỆT và KHÔNG MẬT (scope "documents"). '
      + 'Tài liệu SOẠN TRỰC TIẾP: trả JSON {content}. Tệp đính kèm khi bật object storage (S3/MinIO): '
      + 'MẶC ĐỊNH trả 302 REDIRECT tới presigned URL tải THẲNG từ S3 (backend không nạp tệp vào RAM). '
      + 'Thêm ?mode=stream để backend TRẢ THẲNG BYTES tệp (Content-Type/Content-Disposition; dùng khi '
      + 'consumer không tới được endpoint S3 trực tiếp hoặc cần parse JSON dataUrl như cũ). '
      + 'Bản ghi cũ (base64 trong CSDL) / chưa bật S3: trả JSON {dataUrl} như trước. '
      + 'Có thể ép chế độ toàn cục bằng biến môi trường S3_DOWNLOAD_MODE (query ?mode= ưu tiên hơn).',
    params: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Mã tài liệu' },
      { name: 'mode', in: 'query', required: false, type: 'string', description: 'stream = trả bytes tệp; redirect (mặc định) = 302 tới presigned URL S3' },
    ],
    scope: 'documents',
    hsmtItem: 59,
  },
  {
    id: 'health',
    method: 'GET',
    path: '/api/open/v1/health',
    summary: 'Kiểm tra tình trạng dịch vụ',
    description: 'Trả {ok, service, version}. Dùng để LGSP thăm dò tình trạng dịch vụ. Vẫn yêu cầu khóa API hợp lệ.',
    params: [],
    scope: 'meetings',
    hsmtItem: 58,
  },
];

/** Schema thành phần dùng lại trong OpenAPI (mô tả gọn payload item cuộc họp). */
const MEETING_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    meetingType: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['draft', 'invited', 'live', 'finished', 'cancelled'] },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    room: { type: 'string', nullable: true },
    chairName: { type: 'string', nullable: true },
    hostUnit: { type: 'string', nullable: true },
    participantCount: { type: 'integer' },
  },
};

const PAGE_WRAPPER = (itemsSchema) => ({
  type: 'object',
  properties: {
    page: { type: 'integer' },
    size: { type: 'integer' },
    total: { type: 'integer' },
    totalPages: { type: 'integer' },
    items: { type: 'array', items: itemsSchema },
  },
});

/**
 * Sinh object OpenAPI 3.0 từ CATALOG. serverUrl có thể truyền để điền vào `servers`.
 * Mọi endpoint dùng bảo mật ApiKeyAuth (header X-API-Key) trừ /spec (không nằm trong CATALOG).
 */
export function buildOpenApiSpec(serverUrl = '/') {
  const paths = {};
  for (const e of CATALOG) {
    // đường dẫn OpenAPI: đã dùng {param} sẵn trong CATALOG.path
    const parameters = e.params.map((p) => ({
      name: p.name,
      in: p.in,
      required: !!p.required,
      description: p.description,
      schema: { type: p.type === 'integer' ? 'integer' : 'string' },
    }));

    let okSchema;
    if (e.id === 'health') {
      okSchema = { type: 'object', properties: { ok: { type: 'boolean' }, service: { type: 'string' }, version: { type: 'string' } } };
    } else if (e.id === 'meeting-detail') {
      okSchema = { $ref: '#/components/schemas/MeetingDetail' };
    } else if (e.id === 'meeting-documents') {
      okSchema = { $ref: '#/components/schemas/DocumentList' };
    } else if (e.id === 'document-content') {
      okSchema = { $ref: '#/components/schemas/DocumentContent' };
    } else {
      okSchema = PAGE_WRAPPER(MEETING_ITEM_SCHEMA);
    }

    const responses = {
      200: { description: 'Thành công', content: { 'application/json': { schema: okSchema } } },
      401: { description: 'Thiếu hoặc sai khóa API', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    };
    if (e.scope === 'documents') {
      responses[403] = { description: 'Khóa API không có quyền tài liệu', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
    }
    // /content khi bật object storage (mặc định): 302 tới presigned URL của S3/MinIO.
    if (e.id === 'document-content') {
      responses[302] = {
        description: 'Chuyển hướng tới presigned URL của S3/MinIO để tải tệp trực tiếp (khi bật object storage, chế độ redirect). Header Location chứa URL đã ký, TTL ngắn.',
        headers: { Location: { description: 'Presigned URL tải tệp trực tiếp từ object storage', schema: { type: 'string' } } },
      };
    }

    paths[e.path] = {
      [e.method.toLowerCase()]: {
        operationId: e.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
        summary: e.summary,
        description: `${e.description}\n\n(E-HSMT Hải Phòng — mục ${e.hsmtItem})`,
        tags: ['eCabinet Open API'],
        ...(parameters.length ? { parameters } : {}),
        security: [{ ApiKeyAuth: [] }],
        responses,
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'eCabinet — API công bố cho bên thứ 3',
      description:
        'Bộ API chia sẻ dữ liệu cuộc họp của Hệ thống phòng họp không giấy eCabinet, phục vụ tích hợp với các hệ thống khác của thành phố qua Nền tảng tích hợp và chia sẻ dữ liệu LGSP. Xác thực bằng khóa API qua header X-API-Key.',
      version: '1.0.0',
    },
    servers: [{ url: serverUrl.replace(/\/+$/, '') || '/' }],
    tags: [{ name: 'eCabinet Open API', description: 'Tích hợp và chia sẻ dữ liệu cuộc họp (E-HSMT mục 54–59)' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Khóa API dạng "ecab_...". Có thể gửi qua header "X-API-Key: <key>" hoặc "Authorization: ApiKey <key>".',
        },
      },
      schemas: {
        Error: { type: 'object', properties: { error: { type: 'string' } } },
        MeetingItem: MEETING_ITEM_SCHEMA,
        AgendaItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            order: { type: 'integer' },
            title: { type: 'string' },
            durationMinutes: { type: 'integer' },
            status: { type: 'string', enum: ['pending', 'current', 'done'] },
          },
        },
        Participant: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            name: { type: 'string' },
            unit: { type: 'string', nullable: true },
            role: { type: 'string' },
            attendStatus: { type: 'string' },
            checkedIn: { type: 'boolean' },
          },
        },
        VoteSummary: {
          type: 'object',
          properties: {
            total: { type: 'integer', description: 'Số nội dung biểu quyết' },
            open: { type: 'integer' },
            closed: { type: 'integer' },
            pending: { type: 'integer' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  status: { type: 'string' },
                  eligibleCount: { type: 'integer' },
                  ballotCount: { type: 'integer' },
                  outcome: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        MeetingDetail: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            code: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            meetingType: { type: 'string', nullable: true },
            status: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            room: { type: 'string', nullable: true },
            isOnline: { type: 'boolean' },
            chairName: { type: 'string', nullable: true },
            secretaryName: { type: 'string', nullable: true },
            hostUnit: { type: 'string', nullable: true },
            agenda: { type: 'array', items: { $ref: '#/components/schemas/AgendaItem' } },
            participants: { type: 'array', items: { $ref: '#/components/schemas/Participant' } },
            voteSummary: { $ref: '#/components/schemas/VoteSummary' },
          },
        },
        DocumentMeta: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            kind: { type: 'string' },
            agendaItemId: { type: 'string', nullable: true },
            issuingBody: { type: 'string', nullable: true },
            version: { type: 'integer' },
            size: { type: 'integer', nullable: true },
            mime: { type: 'string', nullable: true },
            contentUrl: { type: 'string' },
          },
        },
        DocumentList: {
          type: 'object',
          properties: {
            meetingId: { type: 'string' },
            total: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/DocumentMeta' } },
          },
        },
        DocumentContent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            mime: { type: 'string', nullable: true },
            content: { type: 'string', nullable: true, description: 'Nội dung văn bản (nếu là tài liệu soạn trực tiếp)' },
            dataUrl: { type: 'string', nullable: true, description: 'Dữ liệu tệp base64 (nếu là tệp tải lên)' },
          },
        },
      },
    },
    paths,
  };
}

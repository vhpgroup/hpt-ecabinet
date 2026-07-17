// ============================================================
// DANH MỤC MÔ TẢ API MỞ (bản sao TypeScript cho UI — E-HSMT mục 54–59).
// NGUỒN DỮ LIỆU cho trang quản trị "Danh mục API" (tab quản lý mô tả API)
// và cho việc sinh OpenAPI JSON client-side ở CHẾ ĐỘ DEMO.
//
// ĐỒNG BỘ TAY với server/src/openapi.js (CATALOG) — 2 môi trường build khác nhau:
// server chạy .js trực tiếp, client bundle .ts. Khi đổi 1 bên PHẢI đổi bên kia.
// ============================================================

export const OPEN_API_BASE = '/api/open/v1';

export type ApiParamIn = 'path' | 'query';

export interface ApiParam {
  name: string;
  in: ApiParamIn;
  required: boolean;
  type: 'string' | 'integer';
  description: string;
}

export interface ApiCatalogEntry {
  id: string;
  method: 'GET';
  path: string;                 // dùng {param}
  summary: string;
  description: string;
  params: ApiParam[];
  scope: 'meetings' | 'documents' | null;
  hsmtItem: number;
}

const pageParams: ApiParam[] = [
  { name: 'page', in: 'query', required: false, type: 'integer', description: 'Trang (mặc định 1)' },
  { name: 'size', in: 'query', required: false, type: 'integer', description: 'Số bản ghi/trang (mặc định 20, tối đa 100)' },
];

export const API_CATALOG: ApiCatalogEntry[] = [
  {
    id: 'unit-meetings-upcoming',
    method: 'GET',
    path: `${OPEN_API_BASE}/units/{unitId}/meetings/upcoming`,
    summary: 'Danh sách cuộc họp của đơn vị sắp diễn ra',
    description: 'Các cuộc họp SẮP/ĐANG diễn ra mà đơn vị chủ trì hoặc có thành phần tham dự thuộc đơn vị. Sắp theo thời gian bắt đầu tăng dần.',
    params: [{ name: 'unitId', in: 'path', required: true, type: 'string', description: 'Mã đơn vị' }, ...pageParams],
    scope: 'meetings',
    hsmtItem: 54,
  },
  {
    id: 'user-meetings-upcoming',
    method: 'GET',
    path: `${OPEN_API_BASE}/users/{userId}/meetings/upcoming`,
    summary: 'Danh sách cuộc họp của cá nhân sắp diễn ra',
    description: 'Các cuộc họp SẮP/ĐANG diễn ra mà cá nhân là thành phần tham dự. Sắp theo thời gian bắt đầu tăng dần.',
    params: [{ name: 'userId', in: 'path', required: true, type: 'string', description: 'Mã người dùng' }, ...pageParams],
    scope: 'meetings',
    hsmtItem: 55,
  },
  {
    id: 'unit-meetings-past',
    method: 'GET',
    path: `${OPEN_API_BASE}/units/{unitId}/meetings/past`,
    summary: 'Danh sách cuộc họp của đơn vị đã diễn ra',
    description: 'Các cuộc họp ĐÃ kết thúc mà đơn vị chủ trì hoặc có thành phần tham dự thuộc đơn vị. Sắp theo thời gian bắt đầu giảm dần.',
    params: [{ name: 'unitId', in: 'path', required: true, type: 'string', description: 'Mã đơn vị' }, ...pageParams],
    scope: 'meetings',
    hsmtItem: 56,
  },
  {
    id: 'user-meetings-past',
    method: 'GET',
    path: `${OPEN_API_BASE}/users/{userId}/meetings/past`,
    summary: 'Danh sách cuộc họp của cá nhân đã diễn ra',
    description: 'Các cuộc họp ĐÃ kết thúc mà cá nhân là thành phần tham dự. Sắp theo thời gian bắt đầu giảm dần.',
    params: [{ name: 'userId', in: 'path', required: true, type: 'string', description: 'Mã người dùng' }, ...pageParams],
    scope: 'meetings',
    hsmtItem: 57,
  },
  {
    id: 'meeting-detail',
    method: 'GET',
    path: `${OPEN_API_BASE}/meetings/{id}`,
    summary: 'Lấy thông tin cuộc họp',
    description: 'Thông tin đầy đủ: metadata + chương trình + thành phần + thống kê biểu quyết tổng hợp. KHÔNG kèm biên bản/kết luận chi tiết/phiếu cá nhân.',
    params: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Mã cuộc họp' }],
    scope: 'meetings',
    hsmtItem: 58,
  },
  {
    id: 'meeting-documents',
    method: 'GET',
    path: `${OPEN_API_BASE}/meetings/{id}/documents`,
    summary: 'Danh sách tài liệu cuộc họp',
    description: 'Tài liệu ĐÃ DUYỆT và KHÔNG MẬT của cuộc họp. Trả metadata + contentUrl. Yêu cầu quyền "documents".',
    params: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Mã cuộc họp' }],
    scope: 'documents',
    hsmtItem: 59,
  },
  {
    id: 'document-content',
    method: 'GET',
    path: `${OPEN_API_BASE}/documents/{id}/content`,
    summary: 'Tải nội dung tài liệu',
    description: 'Nội dung/dữ liệu của 1 tài liệu ĐÃ DUYỆT và KHÔNG MẬT. Yêu cầu quyền "documents".',
    params: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Mã tài liệu' }],
    scope: 'documents',
    hsmtItem: 59,
  },
  {
    id: 'health',
    method: 'GET',
    path: `${OPEN_API_BASE}/health`,
    summary: 'Kiểm tra tình trạng dịch vụ',
    description: 'Trả {ok, service, version}. Dùng để LGSP thăm dò. Vẫn cần khóa API hợp lệ.',
    params: [],
    scope: 'meetings',
    hsmtItem: 58,
  },
];

/** Tổng số endpoint nghiệp vụ (6) — không kể /spec và /health. */
export const API_ENDPOINT_COUNT = API_CATALOG.filter((e) => e.id !== 'health').length;

/**
 * Sinh OpenAPI 3.0 (JSON) client-side cho CHẾ ĐỘ DEMO (khi không có endpoint /spec).
 * Bản rút gọn nhưng đủ dùng đăng ký dịch vụ: paths + securitySchemes ApiKeyAuth.
 * Ở chế độ máy chủ nên tải trực tiếp /api/open/v1/spec (đầy đủ schema hơn).
 */
export function buildOpenApiSpecClient(serverUrl = '/'): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const e of API_CATALOG) {
    const parameters = e.params.map((p) => ({
      name: p.name, in: p.in, required: p.required, description: p.description,
      schema: { type: p.type },
    }));
    paths[e.path] = {
      get: {
        operationId: e.id.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase()),
        summary: e.summary,
        description: `${e.description}\n\n(E-HSMT Hải Phòng — mục ${e.hsmtItem})`,
        tags: ['eCabinet Open API'],
        ...(parameters.length ? { parameters } : {}),
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': { description: 'Thành công' },
          '401': { description: 'Thiếu hoặc sai khóa API' },
          ...(e.scope === 'documents' ? { '403': { description: 'Khóa API không có quyền tài liệu' } } : {}),
          '404': { description: 'Không tìm thấy' },
        },
      },
    };
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'eCabinet — API công bố cho bên thứ 3',
      description: 'Bộ API chia sẻ dữ liệu cuộc họp phục vụ tích hợp qua LGSP. Xác thực bằng khóa API (header X-API-Key).',
      version: '1.0.0',
    },
    servers: [{ url: serverUrl.replace(/\/+$/, '') || '/' }],
    tags: [{ name: 'eCabinet Open API', description: 'Tích hợp và chia sẻ dữ liệu cuộc họp (E-HSMT mục 54–59)' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Khóa API dạng "ecab_...".' },
      },
    },
    paths,
  };
}

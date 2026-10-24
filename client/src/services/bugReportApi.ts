import { request } from './http';
import type { SessionScope } from './http';
import type { BugReportRequest, MessageResponse } from '../types/api';

export function submitBugReport(report: BugReportRequest, auth: SessionScope) {
  return request<MessageResponse>(`/api/bug-reports`, {
    method: 'POST',
    auth,
    body: JSON.stringify(report),
    rateLimitNotice: false,
  });
}

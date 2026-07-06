export const RESUMES_UPDATED_EVENT = "resumes:updated";

export function notifyResumesUpdated() {
  window.dispatchEvent(new Event(RESUMES_UPDATED_EVENT));
}

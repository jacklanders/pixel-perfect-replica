export type ApplicationStatus = "pending" | "sent" | "discarded";

export type Application = {
  id: string;
  user_id: string;
  resume_id: string | null;
  job_post_id: string;
  status: ApplicationStatus;
  discard_reason: string | null;
  generated_subject: string;
  required_subject: string | null;
  generated_body: string;
  destination_email: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

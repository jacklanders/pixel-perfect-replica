export type JobPost = {
  id: string;
  user_id: string;
  source_type: "text" | "image" | "url";
  raw_text: string;
  extracted_json: VacanteExtraida | null;
  employer: string | null;
  role: string | null;
  location: string | null;
  closing_date: string | null;
  created_at: string;
  updated_at: string;
};

export type VacanteExtraida = {
  role: string;
  company: string;
  location: string;
  destinationEmail: string;
  mandatorySubject: string | null;
  requirementsRequired: string[];
  requirementsPreferred: string[];
  closingDate: string | null;
  sourceNotes: string;
  confidence: "high" | "medium" | "low";
};

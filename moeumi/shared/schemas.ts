import { z } from "zod";

export const categories = [
  "대외활동",
  "부트캠프",
  "동아리",
  "공모전",
  "채용",
  "기타",
] as const;
export const labels = {
  title: "활동명",
  category: "카테고리",
  organizer: "주관사",
  startDate: "모집 시작일",
  endDate: "모집 마감일",
  activityStartDate: "활동 시작일",
  activityEndDate: "활동 종료일",
  participationMethod: "참여 방식",
  otherSchedule: "기타 일정",
  summary: "핵심 내용",
  source: "출처",
};
export const draftSchema = z.object({
  title: z.string(),
  category: z.enum(categories),
  organizer: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  activityStartDate: z.string(),
  activityEndDate: z.string(),
  participationMethod: z.string(),
  otherSchedule: z.string(),
  summary: z.string(),
});
export const rowSchema = draftSchema.extend({
  applied: z.boolean().default(false),
  activityStartDate: z.string().default("미입력"),
  activityEndDate: z.string().default("미입력"),
  participationMethod: z.string().default("미입력"),
  otherSchedule: z.string().default("미입력"),
  source: z.string().default(""),
  id: z.string(),
  createdAt: z.number().nullish(),
  customOrder: z.number().optional(),
});
export type Draft = z.infer<typeof draftSchema> & { source: string };
export type Row = z.infer<typeof rowSchema>;
export const blank: Draft = {
  title: "",
  category: "기타",
  organizer: "",
  startDate: "",
  endDate: "",
  activityStartDate: "",
  activityEndDate: "",
  participationMethod: "",
  otherSchedule: "",
  summary: "",
  source: "",
};

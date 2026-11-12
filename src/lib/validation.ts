import { z } from "zod";
import { errors } from "@/lib/copy/en-GB";

const score = z.coerce.number().int().min(1, errors.scoreRange).max(5, errors.scoreRange);
const uuid = z.string().uuid();
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .nullish()
    .transform((s) => (s ? s : null));

export const whenSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    precision: z.enum(["day", "part_of_day", "exact"]),
    part: z.enum(["morning", "midday", "evening"]).nullish(),
    time: z
      .string()
      .regex(/^\d{1,2}:\d{2}$/)
      .nullish(),
  })
  .refine((w) => w.precision !== "part_of_day" || !!w.part, { message: "Pick a part of the day" })
  .refine((w) => w.precision !== "exact" || !!w.time, { message: "Pick a time" });

export type WhenValue = z.infer<typeof whenSchema>;

export const scoresSchema = z.object({ effort: score, impact: score, urgency: score });

export const quickCaptureSchema = scoresSchema.extend({
  title: z.string().trim().min(1, errors.titleRequired).max(300),
});

export const stepSchema = z.object({
  id: uuid.nullish(),
  title: z.string().trim().min(1).max(300),
  done: z.boolean(),
});

export const taskSchema = scoresSchema.extend({
  id: uuid.nullish(),
  title: z.string().trim().min(1, errors.titleRequired).max(300),
  description: optionalText(5000),
  doneWhen: optionalText(300),
  environmentId: uuid.nullish(),
  stateId: uuid.nullish(),
  deadline: whenSchema.nullish(),
  eventId: uuid.nullish(),
  eventRelation: z.enum(["before", "during", "after"]).nullish(),
  leadDays: z.coerce.number().int().min(0).max(365).nullish(),
  steps: z.array(stepSchema).max(100),
});

export type TaskValue = z.infer<typeof taskSchema>;

export const eventSchema = z.object({
  id: uuid.nullish(),
  name: z.string().trim().min(1, errors.nameRequired).max(200),
  start: whenSchema,
  end: whenSchema.nullish(),
});

export type EventValue = z.infer<typeof eventSchema>;

export const filtersSchema = z.object({
  environment_ids: z.array(uuid).default([]),
  state_ids: z.array(uuid).default([]),
  overdue_only: z.boolean().default(false),
});

export type FiltersValue = z.infer<typeof filtersSchema>;

export const nameSchema = z.string().trim().min(1, errors.nameRequired).max(80);

export function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? errors.generic;
}

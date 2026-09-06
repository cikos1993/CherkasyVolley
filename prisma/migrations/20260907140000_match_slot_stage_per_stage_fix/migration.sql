-- Fix `match_slot_stage_check`: the previous per-stage form left a SQL NULL
-- hole. `NULL IN ('SF1','SF2')` evaluates to NULL, and a CHECK constraint
-- passes on NULL (only an explicit FALSE fails it) — so a `stage = 'SEMIFINAL',
-- slot = NULL` row slipped through. Force each non-GROUP branch to FALSE (not
-- NULL) when the slot is absent by requiring `"slot" IS NOT NULL` first.
ALTER TABLE "match" DROP CONSTRAINT "match_slot_stage_check";
ALTER TABLE "match" ADD CONSTRAINT "match_slot_stage_check" CHECK (
  ("stage" = 'GROUP' AND "slot" IS NULL)
  OR (
    "stage" <> 'GROUP' AND "slot" IS NOT NULL AND (
      ("stage" = 'SEMIFINAL' AND "slot" IN ('SF1', 'SF2'))
      OR ("stage" = 'THIRD_PLACE' AND "slot" = 'THIRD_PLACE')
      OR ("stage" = 'FINAL' AND "slot" = 'FINAL')
    )
  )
);

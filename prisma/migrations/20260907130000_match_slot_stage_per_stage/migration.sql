-- Tighten `match_slot_stage_check` (Prisma 7 does not model CHECK constraints;
-- `migrate diff` does not introspect them). The previous form only enforced
-- slot *presence* (`("stage" = 'GROUP') = ("slot" IS NULL)`), so a
-- `stage = 'SEMIFINAL', slot = 'FINAL'` row was permitted. This form pins each
-- stage to its allowed slot(s). No existing row violates it — the only playoff
-- rows so far are the two `SF1`/`SF2` semifinals from playoff formation.
ALTER TABLE "match" DROP CONSTRAINT "match_slot_stage_check";
ALTER TABLE "match" ADD CONSTRAINT "match_slot_stage_check" CHECK (
  ("stage" = 'GROUP' AND "slot" IS NULL)
  OR ("stage" = 'SEMIFINAL' AND "slot" IN ('SF1', 'SF2'))
  OR ("stage" = 'THIRD_PLACE' AND "slot" = 'THIRD_PLACE')
  OR ("stage" = 'FINAL' AND "slot" = 'FINAL')
);

import { test } from "node:test";
import assert from "node:assert/strict";
import { asksToSwitch } from "@/lib/agent/tools/web";

test("a request to switch is told apart from a request to compare", () => {
  for (const text of ["Find me a cheaper electricity deal and set up the switch", "Find a cheaper deal and switch me over", "go ahead", "Etsi halvempi sähkösopimus ja vaihda se", "Hitta ett billigare elavtal och byt till det"]) {
    assert.equal(asksToSwitch(text), true, text);
  }
  for (const text of ["Find me a cheaper electricity deal", "Is there a cheaper mobile plan?", "How much would switching save?"]) {
    assert.equal(asksToSwitch(text), false, text);
  }
});

"use client";
// The profile chooser after the first run ("Switch customer" in settings): the onboarding's profile step on its
// own, with the same demo disclosure. Choosing opens Today straight away.
// Port of ios/Sisu/Features/Picker/PickerScreen.swift (its PressableCardStyle is PressableCard.tsx here).
import { useAppModel } from "@/web/app/AppProvider";
import { ProfileStep } from "@/web/features/Onboarding/ProfileStep";

export default function PickerScreen() {
  const model = useAppModel();
  return <ProfileStep mode="chooser" choose={(customer) => void model.choose(customer)} />;
}

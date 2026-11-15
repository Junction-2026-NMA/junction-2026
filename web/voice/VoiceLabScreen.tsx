"use client";
// The voice lab: push to talk on a session of its own, without the Ask screen. Port of
// ios/Sisu/Voice/VoiceLabScreen.swift. The Path tab shows it when the app is opened with `?voicelab=1`
// (VoiceLaunch). Plain text for what was heard and the answer, the button's state, a mute toggle and the notice.
// With `?voicefixture=1` the button sends a bundled clip; `?voiceauto=1` runs one press by itself.
import { useEffect, useState } from "react";
import { FixtureAPI } from "@/web/core/API";
import { CoachSession } from "@/web/core/CoachSession";
import { CoachText } from "@/web/core/CoachPresentation";
import { RiveBindings } from "@/web/core/RiveContract";
import { VoiceButtonPresenter, VoiceText } from "@/web/core/AppLogic/VoiceLogic";
import { useAppModel, useAppSelector, useCoachSessionState, useVoice } from "@/web/app/AppProvider";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { Screen, ScreenStack } from "@/web/shared/Screen";
import { Eyebrow, Hug, RiveHug, SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import { VoiceController, fixtureRecording } from "./VoiceController";
import { VoiceLaunch } from "./VoiceLaunch";
import "./voicelab.css";

export default function VoiceLabScreen() {
  const model = useAppModel();
  const loaded = useAppSelector((s) => s.customersState.kind === "loaded");
  const [voice, setVoice] = useState<VoiceController | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const { customer, baseURLString } = model.getSnapshot();
    const customerId = customer?.customerId ?? FixtureAPI.customerIds[0] ?? "CUST04974";
    const session = model.isLive ? CoachSession.live(customerId, baseURLString) : CoachSession.sample(customerId);
    const controller = new VoiceController(session, VoiceLaunch.current().voiceFixture ? fixtureRecording() : null);
    // The lab's own session and controller are an external system made here and torn down below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoice(controller);
    return () => {
      session.cancel();
      controller.dispose();
    };
  }, [loaded, model]);

  if (!voice) {
    return (
      <Screen testId="voicelab">
        <p className="sisu-voicelab-loading sisu-font-body" role="status">Loading…</p>
      </Screen>
    );
  }
  return <VoiceLabContent voice={voice} />;
}

function VoiceLabContent({ voice }: { voice: VoiceController }) {
  const state = useVoice(voice);
  const session = useCoachSessionState(voice.session);

  useEffect(() => {
    const launch = VoiceLaunch.current();
    if (!launch.voiceAuto) return;
    const down = window.setTimeout(() => voice.pressDown(), 800);
    const up = window.setTimeout(() => voice.pressUp(), 800 + (launch.voiceHold ?? 0.7) * 1000);
    return () => {
      window.clearTimeout(down);
      window.clearTimeout(up);
    };
  }, [voice]);

  if (!state || !session) return null;
  const heard = [...session.messages].reverse().find((m) => m.role === "user") ?? null;
  const answer = [...session.messages].reverse().find((m) => m.role === "assistant") ?? null;
  const heardText = !heard ? "Hold the button and ask Sisu something." : heard.pending && heard.text === "" ? "Listening…" : heard.text;
  const answerText = !answer
    ? "The answer appears here as it streams."
    : answer.text === "" ? answer.filler ?? (answer.pending ? "Thinking…" : "No answer.") : answer.text;
  const tag = CoachText.dataTag(voice.session.dataLabel);
  const toggleMute = () => voice.setMuted(!state.isMuted);

  const header = (
    <div className="sisu-voicelab-header">
      <h1 className="sisu-font-h1">Voice lab</h1>
      <div className="sisu-voicelab-tags">
        {tag ? (
          <Hug width={RiveHug.sampleTag}>
            <RiveComponent component="Tag" values={RiveBindings.tag(tag, "amber")} {...riveAccessible(tag)} />
          </Hug>
        ) : null}
        {voice.fixture ? <span className="sisu-font-caption sisu-voicelab-muted">Test clip, no microphone</span> : null}
      </div>
    </div>
  );

  return (
    <div className="sisu-voicelab">
      <Screen header={header} tabBar={false} testId="voicelab">
        <ScreenStack>
          <SisuCard>
            <Eyebrow text="You said" />
            <p className="sisu-font-body-large" data-testid="voicelab.transcript">{heardText}</p>
          </SisuCard>
          <SisuCard>
            <Eyebrow text="Sisu" />
            <p className="sisu-font-body" data-testid="voicelab.answer">{answerText}</p>
            {answer?.error ? <p className="sisu-font-label sisu-voicelab-muted">{answer.error}</p> : null}
            <p className="sisu-font-caption sisu-voicelab-muted" data-testid="voicelab.clips">{VoiceText.clipsPlayed(state.clipsPlayed)}</p>
          </SisuCard>
          <SisuCard>
            <div className="sisu-voicelab-row">
              <div className="sisu-voicelab-row-text">
                <span className="sisu-font-h3">Speak replies</span>
                <span className="sisu-font-label sisu-voicelab-muted">{VoiceText.speakRepliesDetail(state.isMuted)}</span>
              </div>
              <RiveComponent component="Toggle" values={RiveBindings.toggle(!state.isMuted)}
                onTrigger={(name) => { if (name === "toggled") toggleMute(); }}
                {...riveAccessible("Speak replies", { isButton: true, value: state.isMuted ? "Off" : "On", action: toggleMute })} />
            </div>
          </SisuCard>
        </ScreenStack>
      </Screen>
      <div className="sisu-voicelab-talk">
        {state.notice ? <p className="sisu-voicelab-notice sisu-font-label" data-testid="voicelab.notice">{state.notice}</p> : null}
        <RiveComponent component="VoiceButton" values={RiveBindings.voiceButton(state.state)} touchScroll={false}
          onTrigger={(name) => voice.handle(name)} testId="voicelab.button"
          {...riveAccessible(voice.accessibilityLabel, { isButton: true, action: () => voice.toggleFromAccessibility() })} />
        <span className="sisu-font-label sisu-voicelab-muted" data-testid="voicelab.state">{VoiceButtonPresenter.label(state.state)}</span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Radio } from "lucide-react";
import { defaultState, fitState, PROTOCOLS, type ClimateState } from "@/lib/ir";
import { CONTROLLERS } from "@/lib/ir/formats";
import { AcUnit } from "./ac-unit";
import { Bay, Screws } from "./hardware";
import { Hub, type Output } from "./hub";
import { Identify, protocolChoice, trialFromChoice } from "./identify";
import { Remote } from "./remote";
import { SmartIrBuilder } from "./smartir-builder";

export function Guide() {
  const [choice, setChoice] = useState(protocolChoice(PROTOCOLS[0]));
  const [draft, setDraft] = useState<ClimateState | null>(null);
  const [output, setOutput] = useState<Output>({ controller: CONTROLLERS[0].id, option: 0 });

  const trial = trialFromChoice(choice);
  const state = fitState(trial.protocol, draft ?? defaultState(trial.protocol));

  return (
    <div className="bench min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <header className="chassis relative flex flex-wrap items-center justify-between gap-5 px-6 py-5 sm:px-8">
          <Screws />
          <div className="flex items-center gap-3">
            <span className="well flex size-11 items-center justify-center text-[#12533e]">
              <Radio className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-[0.12em] text-[#1d1b16] uppercase">Aircon IR coder</h1>
              <p className="text-xs text-[#5f5a52]">Make a SmartIR file for your aircon: pick its protocol, set the remote, print the file.</p>
            </div>
          </div>
          <div className="w-full lg:w-auto lg:min-w-[34rem]">
            <Identify
              value={choice}
              onChange={(next) => {
                setChoice(next);
                setDraft(null);
              }}
            />
          </div>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
          <Bay title="Your aircon" aside={trial.protocol.bits + "-bit frame"}>
            <AcUnit state={state} />
          </Bay>
          <Bay title="Remote" aside={(trial.protocol.frequency / 1000).toFixed(0) + " kHz"}>
            <Remote trial={trial} state={state} onState={setDraft} />
          </Bay>
          <Bay title="Controller">
            <Hub trial={trial} state={state} output={output} onOutput={setOutput} />
          </Bay>
        </div>

        <Bay title="SmartIR file" aside={`${PROTOCOLS.length} protocols`}>
          <div className="chassis relative px-6 py-7 sm:px-8">
            <Screws />
            <SmartIrBuilder key={choice} trial={trial} base={state} output={output} />
          </div>
        </Bay>
      </div>
    </div>
  );
}

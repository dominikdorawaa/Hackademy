import { V86 } from "v86";
import { UkosRuntime } from "./runtime";
import { workshopStorage } from "./storage";
import type { RuntimeCommand, RuntimeEvent } from "./protocol";

const emit = (event: RuntimeEvent) => postMessage(event);
const runtime = new UkosRuntime({
  create: (options) => new V86(options),
  emit,
  manifest: async (base) => {
    const response = await fetch(`${base}/manifest.json`);
    if (!response.ok)
      throw new Error("Brak obrazu Linuksa. Uruchom npm run ukos:prepare.");
    return response.json();
  },
  storage: workshopStorage,
});

let started = false;
onmessage = async (message: MessageEvent<RuntimeCommand>) => {
  if (message.data.type !== "start") {
    if (started) await runtime.handle(message.data);
    return;
  }
  if (started) return;
  if (!navigator.locks) {
    emit({
      type: "status",
      status: "error",
      message:
        "Ta przeglądarka nie obsługuje blokady warsztatu. Użyj aktualnej wersji Chrome lub Firefox.",
    });
    return;
  }
  await navigator.locks.request(
    `ukos-prototype:${message.data.account}`,
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        emit({
          type: "status",
          status: "error",
          message:
            "Warsztat działa już w innej karcie. Zatrzymaj go tam przed otwarciem kolejnego.",
        });
        return;
      }
      started = true;
      await runtime.handle(message.data);
      await new Promise<void>(() => {});
    },
  );
};

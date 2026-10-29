import { Redirect, useLocalSearchParams } from "expo-router";
import { TastingComposer } from "../../src/features/tasting/TastingComposer";
import { newTastingDraft } from "../../src/features/tasting/draft";
/** Isolated long-edit keyboard fixture. No account, API or persistence writes. */
export default function EditorKeyboardPreview() {
  const { short } = useLocalSearchParams<{ short?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const note = short
    ? "과일 향이 은은하고 부드러웠어요."
    : Array.from(
        { length: 24 },
        (_, i) =>
          `${i + 1}. 과일 향이 은은했고 입안에서는 부드러웠어요. 마신 뒤에는 나무 향이 조금 남았어요.`,
      ).join("\n");
  const initial = newTastingDraft(
    "keyboard-fixture",
    "keyboard-fixture",
    "whisky",
    "deep",
  );
  initial.stage = "edit";
  initial.composition = {
    text: note,
    editBuffer: note,
    edited: false,
    sourceRevision: initial.revision,
  };
  return (
    <TastingComposer
      key={short ? "short" : "long"}
      initial={initial}
      onChange={() => {}}
      onSave={async () => {
        throw new Error("Fixture has no server");
      }}
      onClose={() => {}}
      previewOnly
    />
  );
}

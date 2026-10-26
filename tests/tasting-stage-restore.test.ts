import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelNoteEdit, newTastingDraft, restoredTastingView, type TastingDraft } from '../src/features/tasting/draft';
import { createTastingDraftStorage } from '../src/features/tasting/draft-storage';
import { parseTastingDraft } from '../src/features/tasting/validate-draft';

test('persisted note stage survives restore without changing observations or discarding empty edits', async () => {
  for (const category of ['whisky','wine','beer','traditional'] as const) {
    for (const mode of ['light','deep'] as const) {
      let raw: string | null = null;
      const storage = createTastingDraftStorage({
        getItem: async () => raw,
        setItem: async (_key,value) => { raw = value; },
        removeItem: async () => { raw = null; },
      });
      const base = newTastingDraft('qa-owner','qa-record',category,mode);
      const preview: TastingDraft = {...base,stage:'preview',composition:{text:'마지막으로 적용한 문장',edited:true,sourceRevision:base.revision}};
      await storage.persist(preview);
      const reopened = (await storage.restore(base.ownerId,base.recordId))!;
      assert.equal(restoredTastingView(reopened),'preview');
      assert.deepEqual(reopened.modes,base.modes);
      const editing: TastingDraft = {...preview,stage:'edit',composition:{...preview.composition!,editBuffer:''}};
      await storage.persist(editing);
      const emptyEdit = (await storage.restore(base.ownerId,base.recordId))!;
      assert.equal(restoredTastingView(emptyEdit),'edit');
      assert.equal(emptyEdit.composition?.editBuffer,'');
      const cancelled: TastingDraft = {...cancelNoteEdit(emptyEdit),stage:'preview'};
      await storage.persist(cancelled);
      const afterCancel = (await storage.restore(base.ownerId,base.recordId))!;
      assert.equal(restoredTastingView(afterCancel),'preview');
      assert.equal(afterCancel.composition?.text,'마지막으로 적용한 문장');
      assert.equal(afterCancel.composition?.editBuffer,undefined);
      await storage.persist({...afterCancel,stage:'questions'});
      assert.equal(restoredTastingView((await storage.restore(base.ownerId,base.recordId))!),'questions');
    }
  }
});

test('legacy drafts keep their old fallback; pending saves always restore immutable preview', () => {
  const base = newTastingDraft('qa-owner','qa-record','wine','deep');
  assert.equal(restoredTastingView(base),'questions');
  const old = {...base,composition:{text:'원문',edited:true,sourceRevision:1}};
  assert.equal(restoredTastingView(old),'questions');
  const editor: TastingDraft = {...old,composition:{...old.composition,editBuffer:''}};
  assert.equal(restoredTastingView(editor),'edit');
  const pending: TastingDraft = {...editor,stage:'edit',pendingSave:{operationId:'a0c1ea48-afd7-4526-9262-fd79836da555',expectedRevision:1}};
  assert.equal(restoredTastingView(parseTastingDraft(JSON.stringify(pending),base.ownerId,base.recordId)),'preview');
  assert.throws(()=>parseTastingDraft(JSON.stringify({...base,stage:'invented'}),base.ownerId,base.recordId),/Invalid draft stage/);
});

import { Reducer } from 'redux';

import * as sync from '../index';

const kind = 'kind';
const otherKind = 'something';
const otherModel: sync.SyncModel = { kind: otherKind, _id: 'nope' };

let emptyState: sync.ReducerState<sync.SyncModel>;
let emptyAction: sync.Action<sync.SyncModel>;
let state: sync.ReducerState<sync.SyncModel>;
const model1: sync.SyncModel = { kind: kind, value: 1, _id: '1234' };
const model2: sync.SyncModel = { kind: kind, value: 2, _id: '2345' };
const model3: sync.SyncModel = { kind: kind, value: 3, _id: '3456' };
const models = [model1, model2];
let reducer: Reducer<sync.ReducerState<sync.SyncModel>>;

beforeEach(() => {
  // tslint:disable-next-line no-any
  emptyState = (undefined as any) as sync.ReducerState<sync.SyncModel>;
  // tslint:disable-next-line no-any
  emptyAction = ({} as any) as sync.Action<sync.SyncModel>;
  reducer = sync.createReducer(kind);
  state = reducer(emptyState, emptyAction);
});

describe('create reducer', () => {
  it('handles initial state', () => {
    expect(state).toMatchObject({ initialized: false, models: [] });
  });

  describe('handles MODEL_INITIALIZED', () => {
    it('regularly', () => {
      state = reducer(state, sync.modelInitialized(kind));
      expect(state).toMatchObject({ initialized: true });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.modelInitialized(otherKind));
      expect(state).toMatchObject({ initialized: false });
    });
  });

  describe('handles LOAD_MODELS', () => {
    it('regularly', () => {
      state = reducer(state, sync.loadModels(models, kind));
      expect(state).toMatchObject({ models: models });
    });

    it('and it overrides the current models', () => {
      state = reducer(state, sync.insertModel(model3));
      state = reducer(state, sync.loadModels(models, kind));
      expect(state).toMatchObject({ models: models });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.loadModels([otherModel], otherKind));
      expect(state).toMatchObject({ models: [] });
    });
  });

  describe('handles INSERT_MODEL', () => {
    it('regularly', () => {
      state = reducer(state, sync.insertModel(model1));
      expect(state).toMatchObject({ models: [model1] });
    });

    it('multiple times', () => {
      state = reducer(state, sync.insertModel(model1));
      state = reducer(state, sync.insertModel(model2));
      expect(state).toMatchObject({ models: [model1, model2] });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.insertModel(otherModel));
      expect(state).toMatchObject({ models: [] });
    });
  });

  describe('handles INSERT_BULK_MODELS', () => {
    it('regularly', () => {
      state = reducer(state, sync.insertBulkModels(models, kind));
      expect(state).toMatchObject({ models: models });
    });

    it('multiple times', () => {
      state = reducer(state, sync.insertBulkModels(models, kind));
      state = reducer(state, sync.insertBulkModels([model3], kind));
      expect(state).toMatchObject({ models: [model1, model2, model3] });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.insertBulkModels([otherModel], otherKind));
      expect(state).toMatchObject({ models: [] });
    });
  });

  describe('handles UPDATE_MODEL', () => {
    it('regularly', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(state, sync.updateModel({ ...model1, value: 2 }));
      expect(state).toMatchObject({
        models: [{ ...model1, value: 2 }, model2],
      });
    });

    it('multiple times', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(state, sync.updateModel({ ...model1, value: 2 }));
      state = reducer(state, sync.updateModel({ ...model1, value: 3 }));
      expect(state).toMatchObject({
        models: [{ ...model1, value: 3 }, model2],
      });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(state, sync.updateModel(otherModel));
      expect(state).toMatchObject({ models: models });
    });
  });

  describe('handles UPDATE_BULK_MODELS', () => {
    it('regularly', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.updateBulkModels([{ ...model1, value: 2 }], kind)
      );
      expect(state).toMatchObject({
        models: [{ ...model1, value: 2 }, model2],
      });
    });

    it('multiple times', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.updateBulkModels([{ ...model1, value: 2 }], kind)
      );
      state = reducer(
        state,
        sync.updateBulkModels([{ ...model1, value: 3 }], kind)
      );
      expect(state).toMatchObject({
        models: [{ ...model1, value: 3 }, model2],
      });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(state, sync.updateBulkModels([otherModel], otherKind));
      expect(state).toMatchObject({ models: models });
    });
  });

  describe('handles REMOVE_MODEL', () => {
    it('regularly', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.removeModel({ _id: model1._id, _rev: model1._rev as string }, kind)
      );
      expect(state).toMatchObject({
        models: [model2],
      });
    });

    it('multiple times', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.removeModel({ _id: model1._id, _rev: model1._rev as string }, kind)
      );
      state = reducer(
        state,
        sync.removeModel({ _id: model2._id, _rev: model2._rev as string }, kind)
      );
      expect(state).toMatchObject({
        models: [],
      });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.removeModel(
          { _id: otherModel._id, _rev: otherModel._rev as string },
          otherKind
        )
      );
      expect(state).toMatchObject({ models: models });
    });
  });

  describe('handles REMOVE_BULK_MODELS', () => {
    it('regularly', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.removeBulkModels(
          [{ _id: model1._id, _rev: model1._rev as string }],
          kind
        )
      );
      expect(state).toMatchObject({
        models: [model2],
      });
    });

    it('multiple times', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.removeBulkModels(
          [{ _id: model1._id, _rev: model1._rev as string }],
          kind
        )
      );
      state = reducer(
        state,
        sync.removeBulkModels(
          [{ _id: model2._id, _rev: model2._rev as string }],
          kind
        )
      );
      expect(state).toMatchObject({
        models: [],
      });
    });

    it('for other kinds', () => {
      state = reducer(state, sync.loadModels(models, kind));
      state = reducer(
        state,
        sync.removeBulkModels(
          [{ _id: otherModel._id, _rev: otherModel._rev as string }],
          otherKind
        )
      );
      expect(state).toMatchObject({ models: models });
    });
  });
});

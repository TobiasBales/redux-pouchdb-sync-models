import { Reducer } from 'redux';

import {
  INSERT_BULK_MODELS,
  INSERT_MODEL,
  InsertBulkModels,
  InsertModel,
  LOAD_MODELS,
  LoadModels,
  MODEL_INITIALIZED,
  ModelInitialized,
  REMOVE_BULK_MODELS,
  REMOVE_MODEL,
  RemoveBulkModels,
  RemoveModel,
  SyncModel,
  UPDATE_BULK_MODELS,
  UPDATE_MODEL,
  UpdateBulkModels,
  UpdateModel,
} from './index';

export type Action<T extends SyncModel> =
  | ModelInitialized
  | LoadModels<T>
  | InsertBulkModels<T>
  | InsertModel<T>
  | UpdateBulkModels<T>
  | UpdateModel<T>
  | RemoveBulkModels
  | RemoveModel;

export interface ReducerState<T> {
  models: T[];
  initialized: boolean;
}

// tslint:disable max-func-body-length
export function createReducer<T extends SyncModel>(
  kind: string
): Reducer<ReducerState<T>> {
  const initialState = { models: [] as T[], initialized: false };

  return (
    state: ReducerState<T> = initialState,
    action: Action<T>
  ): ReducerState<T> => {
    switch (action.type) {
      case MODEL_INITIALIZED:
        if (action.meta.kind !== kind) {
          return state;
        }

        return { ...state, initialized: true };

      case LOAD_MODELS:
        if (action.meta.kind !== kind) {
          return state;
        }

        return { ...state, models: action.payload };

      case INSERT_MODEL:
        if (action.meta.kind !== kind) {
          return state;
        }

        return { ...state, models: [...state.models, action.payload] };

      case INSERT_BULK_MODELS:
        if (action.meta.kind !== kind) {
          return state;
        }

        return { ...state, models: [...state.models, ...action.payload] };

      case UPDATE_MODEL:
        if (action.meta.kind !== kind) {
          return state;
        }

        return {
          ...state,
          models: state.models.map(
            m => (m._id === action.payload._id ? action.payload : m)
          ),
        };

      case UPDATE_BULK_MODELS: {
        if (action.meta.kind !== kind) {
          return state;
        }

        const ids = action.payload.map(m => m._id);

        return {
          ...state,
          models: state.models.map(m => {
            if (ids.indexOf(m._id) === -1) {
              return m;
            }

            return action.payload[ids.indexOf(m._id)];
          }),
        };
      }

      case REMOVE_MODEL:
        if (action.meta.kind !== kind) {
          return state;
        }

        return {
          ...state,
          models: state.models.filter(m => m._id !== action.payload._id),
        };

      case REMOVE_BULK_MODELS: {
        if (action.meta.kind !== kind) {
          return state;
        }

        const ids = action.payload.map(m => m._id);

        return {
          ...state,
          models: state.models.filter(m => ids.indexOf(m._id) === -1),
        };
      }

      default:
        return state;
    }
  };
}

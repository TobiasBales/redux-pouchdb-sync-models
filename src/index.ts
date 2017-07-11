import {
  Initialized,
  initialized,
  InsertBulkModels,
  insertBulkModels,
  InsertModel,
  insertModel,
  LoadModels,
  loadModels,
  MaybeModel,
  ModelError,
  modelError,
  modelInitialized,
  ModelInitialized,
  RemoveBulkModels,
  removeBulkModels,
  RemoveModel,
  removeModel,
  SyncModel,
  UpdateBulkModels,
  updateBulkModels,
  UpdateModel,
  updateModel,
} from './actions';
import {
  INITIALIZED,
  INSERT_BULK_MODELS,
  INSERT_MODEL,
  LOAD_MODELS,
  MODEL_ERROR,
  MODEL_INITIALIZED,
  REMOVE_BULK_MODELS,
  REMOVE_MODEL,
  UPDATE_BULK_MODELS,
  UPDATE_MODEL,
} from './constants';
import { Action, createReducer, ReducerState } from './reducer';
import { ReplicationWrapper } from './ReplicationWrapper';
import { sync } from './sync';

// Sync middleware
export { sync };

// Action type constants
export {
  INITIALIZED,
  INSERT_BULK_MODELS,
  INSERT_MODEL,
  LOAD_MODELS,
  MODEL_ERROR,
  MODEL_INITIALIZED,
  REMOVE_BULK_MODELS,
  REMOVE_MODEL,
  UPDATE_BULK_MODELS,
  UPDATE_MODEL,
};

// Action types
export {
  Initialized,
  InsertBulkModels,
  InsertModel,
  LoadModels,
  ModelError,
  ModelInitialized,
  RemoveBulkModels,
  RemoveModel,
  UpdateBulkModels,
  UpdateModel,
};

// Action creators
export {
  initialized,
  insertBulkModels,
  insertModel,
  loadModels,
  modelError,
  modelInitialized,
  updateBulkModels,
  updateModel,
  removeBulkModels,
  removeModel,
};

export {
  Action,
  createReducer,
  ReducerState,
  MaybeModel,
  SyncModel,
  ReplicationWrapper,
};

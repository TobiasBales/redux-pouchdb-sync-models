import { Action } from 'redux';

import * as constants from './constants';
import { uuid } from './utils/uuid';

export interface MaybeModel {
  kind?: string;
}

export type Operation =
  | constants.OPERATION_CHANGES
  | constants.OPERATION_FETCH_DOCS
  | constants.OPERATION_INSERT
  | constants.OPERATION_BULK_INSERT
  | constants.OPERATION_BULK_UPDATE
  | constants.OPERATION_UPDATE
  | constants.OPERATION_BULK_REMOVE
  | constants.OPERATION_REMOVE;

export type LoadModels<M extends SyncModel> = {
  type: constants.LOAD_MODELS;
  payload: M[];
  meta: { kind: string };
};

export function initialized(name?: string): Initialized {
  return {
    type: constants.INITIALIZED,
    meta: {
      name: name,
    },
  };
}

export type Initialized = {
  type: constants.INITIALIZED;
  meta: { name?: string };
};

export function modelInitialized(kind: string): ModelInitialized {
  return { type: constants.MODEL_INITIALIZED, meta: { kind: kind } };
}

export type ModelInitialized = {
  type: constants.MODEL_INITIALIZED;
  meta: { kind: string };
};

export function loadModels<M extends SyncModel>(
  models: M[],
  kind: string
): LoadModels<M> {
  return { type: constants.LOAD_MODELS, payload: models, meta: { kind: kind } };
}

export type ModelMeta = { kind: string; fromSync: boolean };

export type InsertModel<M extends SyncModel> = {
  type: constants.INSERT_MODEL;
  payload: M;
  meta: ModelMeta;
};

export function insertModel<M extends SyncModel>(
  model: M,
  fromSync: boolean = false
): InsertModel<M> {
  return {
    type: constants.INSERT_MODEL,
    payload: model,
    meta: { kind: model.kind, fromSync: fromSync },
  };
}

export type InsertBulkModels<M extends SyncModel> = {
  type: constants.INSERT_BULK_MODELS;
  payload: M[];
  meta: ModelMeta;
};

export function insertBulkModels<M extends SyncModel>(
  models: M[],
  kind: string,
  fromSync: boolean = false
): InsertBulkModels<M> {
  return {
    type: constants.INSERT_BULK_MODELS,
    payload: models,
    meta: { kind: kind, fromSync: fromSync },
  };
}

export type UpdateModel<M extends SyncModel> = {
  type: constants.UPDATE_MODEL;
  payload: M;
  meta: ModelMeta;
};

export function updateModel<M extends SyncModel>(
  model: M,
  fromSync: boolean = false
): UpdateModel<M> {
  return {
    type: constants.UPDATE_MODEL,
    payload: model,
    meta: { kind: model.kind, fromSync: fromSync },
  };
}

export type UpdateBulkModels<M extends SyncModel> = {
  type: constants.UPDATE_BULK_MODELS;
  payload: M[];
  meta: ModelMeta;
};

export function updateBulkModels<M extends SyncModel>(
  models: M[],
  kind: string,
  fromSync: boolean = false
): UpdateBulkModels<M> {
  return {
    type: constants.UPDATE_BULK_MODELS,
    payload: models,
    meta: { kind: kind, fromSync: fromSync },
  };
}

export type RemoveModel = {
  type: constants.REMOVE_MODEL;
  payload: { _id: string; _rev: string };
  meta: ModelMeta;
};

export function removeModel(
  doc: { _id: string; _rev: string },
  kind: string,
  fromSync: boolean = false
): RemoveModel {
  return {
    type: constants.REMOVE_MODEL,
    payload: doc,
    meta: { kind: kind, fromSync: fromSync },
  };
}

export type RemoveBulkModels = {
  type: constants.REMOVE_BULK_MODELS;
  payload: { _id: string; _rev: string }[];
  meta: ModelMeta;
};

export function removeBulkModels(
  models: { _id: string; _rev: string }[],
  kind: string,
  fromSync: boolean = false
): RemoveBulkModels {
  return {
    type: constants.REMOVE_BULK_MODELS,
    payload: models,
    meta: { kind: kind, fromSync: fromSync },
  };
}

export type ModelError = {
  type: constants.MODEL_ERROR;
  payload: Error;
  meta: { operation: Operation };
};

export function modelError(error: Error, operation: Operation): ModelError {
  return {
    type: constants.MODEL_ERROR,
    payload: error,
    meta: { operation: operation },
  };
}

export interface SyncModel {
  kind: string;
  _id: string;
  _rev?: string;
  createdAt: Date;
  modifiedAt: Date;
  // tslint:disable-next-line no-any
  [k: string]: any;
  toJSON?(): Object;
}

export interface SyncModelData {
  kind: string;
  _id?: string;
  _rev?: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

/**
 * SyncModelBase offers a basic implementation of setting/creating _id, createdAt and modifiedAt 
 */
export class SyncModelBase implements SyncModel {
  public readonly kind: string;
  public readonly _id: string;
  public readonly _rev?: string;
  public readonly createdAt: Date;
  public modifiedAt: Date;

  constructor(data: SyncModelData) {
    this.kind = data.kind;
    this._id = data._id !== undefined ? data._id : uuid();
    this._rev = data._rev;
    this.createdAt = data.createdAt !== undefined ? data.createdAt : new Date();
    this.modifiedAt =
      data.modifiedAt !== undefined ? data.modifiedAt : new Date();
  }
}

export type DeletedDoc = PouchDB.Core.IdMeta &
  PouchDB.Core.RevisionIdMeta & { _deleted: boolean };

export function isDeletedDoc(
  doc: PouchDB.Core.ExistingDocument<{}>
): doc is DeletedDoc {
  return '_deleted' in doc;
}

export function isModel(doc?: {}): doc is SyncModel {
  return doc !== undefined && 'kind' in doc;
}

export function isModelToSync(
  doc?: {},
  modelsToSync: string[] = []
): doc is SyncModel {
  return isModel(doc) && modelsToSync.indexOf(doc.kind) >= 0;
}

export function isAction(action: {} | Function): action is Action {
  return typeof action !== 'function' && 'type' in action;
}

export type ActionWithMeta = {
  type: string;
  meta: { [k: string]: number | string | boolean | undefined };
};

type ActionWithFromSyncMeta = {
  type: string;
  meta: {
    fromSync: boolean;
    [k: string]: number | string | boolean | undefined;
  };
};

export function isInsertAction(
  action: {} | Function
): action is InsertModel<SyncModel> {
  return isAction(action) && action.type === constants.INSERT_MODEL;
}

export function isBulkInsertAction(
  action: {} | Function
): action is InsertBulkModels<SyncModel> {
  return isAction(action) && action.type === constants.INSERT_BULK_MODELS;
}

export function isUpdateAction(
  action: {} | Function
): action is UpdateModel<SyncModel> {
  return isAction(action) && action.type === constants.UPDATE_MODEL;
}

export function isBulkUpdateAction(
  action: {} | Function
): action is UpdateBulkModels<SyncModel> {
  return isAction(action) && action.type === constants.UPDATE_BULK_MODELS;
}

export function isRemoveAction(action: {} | Function): action is RemoveModel {
  return isAction(action) && action.type === constants.REMOVE_MODEL;
}

export function isBulkRemoveAction(
  action: {} | Function
): action is RemoveBulkModels {
  return isAction(action) && action.type === constants.REMOVE_BULK_MODELS;
}

export function hasMeta(action: {} | Function): action is ActionWithMeta {
  return 'meta' in action;
}

function hasFromSyncMeta(
  action: ActionWithMeta
): action is ActionWithFromSyncMeta {
  return 'fromSync' in action.meta;
}

export function isFromSync(action: {} | Function) {
  if (!isAction(action)) {
    return false;
  }

  if (!hasMeta(action)) {
    return false;
  }

  if (!hasFromSyncMeta(action)) {
    return false;
  }

  return action.meta.fromSync;
}

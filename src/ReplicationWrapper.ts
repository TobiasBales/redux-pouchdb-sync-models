import { MaybeModel } from './actions';

export type ChangeInfo = PouchDB.Replication.SyncResult<MaybeModel>;
export type CompleteInfo = PouchDB.Replication.SyncResultComplete<MaybeModel>;
export type EventType =
  | 'change'
  | 'active'
  | 'complete'
  | 'paused'
  | 'denied'
  | 'error';

// tslint:disable unified-signatures

/**
 * ReplicationWrapper wraps one or more PouchDB.Replication.Syncs and can be used
 * to lazily add more sync results to the middleware after the fact
 * (e.g. starting replication after the user logged in)
 */
export class ReplicationWrapper {
  private wrapped: PouchDB.Replication.Sync<MaybeModel>[];

  constructor() {
    this.wrapped = [];
  }

  public on(event: 'change', listener: (info: ChangeInfo) => void): this;
  public on(event: 'active', listener: () => void): this;
  public on(event: 'complete', listener: (info: CompleteInfo) => void): this;
  public on(event: 'paused', listener: (err: {}) => void): this;
  public on(event: 'denied', listener: (err: {}) => void): this;
  public on(event: 'error', listener: (err: {}) => void): this;
  public on(event: EventType, listener: () => void): this {
    this.wrapped.forEach(sync => {
      sync.on(event as 'change', listener);
    });

    return this;
  }

  public cancel(): void {
    this.wrapped.forEach(sync => {
      sync.cancel();
    });
  }
}

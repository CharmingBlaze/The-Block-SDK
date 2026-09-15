import type { InteractionClaim } from "./tool";

export class InteractionCoordinator {
  private owner: string | null = null;
  private pointerIds = new Set<number>();

  get activeOwner(): string | null {
    return this.owner;
  }

  claim(next: InteractionClaim): boolean {
    if (this.owner && this.owner !== next.owner) {
      return false;
    }
    this.owner = next.owner;
    for (const id of next.pointerIds) {
      this.pointerIds.add(id);
    }
    return true;
  }

  ownerOf(pointerId: number): string | null {
    return this.pointerIds.has(pointerId) ? this.owner : null;
  }

  release(owner: string): void {
    if (this.owner === owner) {
      this.owner = null;
      this.pointerIds.clear();
    }
  }

  dispose(): void {
    this.owner = null;
    this.pointerIds.clear();
  }
}

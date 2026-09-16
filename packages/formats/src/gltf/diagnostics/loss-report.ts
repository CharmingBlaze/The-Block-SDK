import type { GltfDiagnostic } from "./gltf-diagnostic";
import { diagnostic } from "./gltf-diagnostic";

export class DiagnosticSink {
  readonly warnings: GltfDiagnostic[] = [];
  readonly repairs: GltfDiagnostic[] = [];
  readonly losses: GltfDiagnostic[] = [];

  warn(code: string, message: string, extra: Omit<GltfDiagnostic, "code" | "severity" | "message"> = {}): void {
    this.warnings.push(diagnostic(code, "warning", message, extra));
  }

  repair(code: string, message: string, extra: Omit<GltfDiagnostic, "code" | "severity" | "message"> = {}): void {
    this.repairs.push(diagnostic(code, "info", message, extra));
  }

  loss(code: string, message: string, extra: Omit<GltfDiagnostic, "code" | "severity" | "message"> = {}): void {
    this.losses.push(diagnostic(code, "loss", message, extra));
  }

  warningMessages(): string[] {
    return this.warnings.map((item) => item.message);
  }

  lossMessages(): string[] {
    return [...this.losses, ...this.repairs].map((item) => item.message);
  }
}

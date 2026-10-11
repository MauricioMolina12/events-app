import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import type { DeskSedeMetrics } from '../../registration-desk/registration-desk.api';

interface SedeBar {
  readonly id: string;
  readonly name: string;
  readonly titulares: number;
  readonly checkedIn: number;
  readonly pending: number;
  readonly people: number;
  /** Width of the registered bar, relative to the busiest sede. */
  readonly width: number;
  /** Share of that bar already inside. */
  readonly insideWidth: number;
  readonly rate: string;
}

/**
 * One row per establishment with its own registered and checked-in titulares. Each row
 * is labelled with the sede's name and numbers, so Barby Toys and Cupidos never blend.
 */
@Component({
  selector: 'app-sede-bars',
  imports: [TranslatePipe],
  templateUrl: './sede-bars.html',
  styleUrl: './charts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SedeBars {
  readonly sedes = input.required<readonly DeskSedeMetrics[]>();
  readonly selectedId = input<string | null>(null);
  readonly selectSede = output<string | null>();

  protected readonly bars = computed<readonly SedeBar[]>(() => {
    const sedes = this.sedes();
    const max = Math.max(1, ...sedes.map((sede) => sede.titulares));
    return sedes.map((sede) => ({
      id: sede.participationId,
      name: sede.establishment.name,
      titulares: sede.titulares,
      checkedIn: sede.checkedIn,
      pending: sede.pending,
      people: sede.people,
      width: (sede.titulares / max) * 100,
      insideWidth: sede.titulares === 0 ? 0 : (sede.checkedIn / sede.titulares) * 100,
      rate: `${(Math.round(sede.attendanceRate * 1000) / 10).toLocaleString('es-CO')}%`,
    }));
  });

  protected toggle(id: string): void {
    this.selectSede.emit(this.selectedId() === id ? null : id);
  }
}

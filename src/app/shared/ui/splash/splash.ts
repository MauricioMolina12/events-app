import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import { Splash } from '@core/ui/splash';
import { BrandMark } from '../brand-mark/brand-mark';

@Component({
  selector: 'app-splash',
  imports: [BrandMark, TranslatePipe],
  templateUrl: './splash.html',
  styleUrl: './splash.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashScreen {
  protected readonly splash = inject(Splash);
}

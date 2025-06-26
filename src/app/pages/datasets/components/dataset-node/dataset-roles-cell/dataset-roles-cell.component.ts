import {
  ChangeDetectionStrategy, Component, computed, input,
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { uniq } from 'lodash-es';
import { DatasetDetails } from 'app/interfaces/dataset.interface';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { doesDatasetHaveShares, ixAppsDataset } from 'app/pages/datasets/utils/dataset.utils';

@Component({
  selector: 'ix-dataset-roles-cell',
  templateUrl: './dataset-roles-cell.component.html',
  styleUrls: ['./dataset-roles-cell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxIconComponent,
    TranslateModule,
    MatTooltip,
  ],
})
export class DatasetRolesCellComponent {
  readonly dataset = input.required<DatasetDetails>();
  readonly isSystemDataset = input.required<boolean>();

  readonly isApps = computed(() => this.dataset().name.endsWith(ixAppsDataset));
  readonly appNames = computed(() => uniq(this.dataset().apps?.map((app) => app.name))?.join(', ') || '');
  readonly vmNames = computed(() => uniq(this.dataset().vms?.map((vm) => vm.name))?.join(', ') || '');

  readonly hasShares = computed(() => doesDatasetHaveShares(this.dataset()));

  readonly directWebShares = computed(() => {
    return this.dataset().webshares?.filter((share) => !share.inherited) || [];
  });

  readonly inheritedWebShares = computed(() => {
    return this.dataset().webshares?.filter((share) => share.inherited) || [];
  });

  constructor(private translate: TranslateService) {}

  inheritedWebShareTooltip(): string {
    const shares = this.inheritedWebShares();
    if (!shares.length) {
      return '';
    }
    const shareNames = shares.map((share) => share.name).join(', ');
    return this.translate.instant('Dataset is shared via WebShare (inherited from: {shareNames})', { shareNames });
  }
}

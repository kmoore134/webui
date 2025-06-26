import {
  ChangeDetectionStrategy, Component, OnInit, computed, signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  filter, switchMap, tap, of, map,
} from 'rxjs';
import { EmptyType } from 'app/enums/empty-type.enum';
import { Role } from 'app/enums/role.enum';
import { helptextSharingWebshare } from 'app/helptext/sharing/webshare/webshare';
import { WebShareConfig } from 'app/interfaces/webshare-config.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions/ix-cell-actions.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { createTable } from 'app/modules/ix-table/utils';
import { PageHeaderComponent } from 'app/modules/page-header/page-title-header/page-header.component';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { WebShareAltrootFormComponent } from 'app/pages/sharing/webshare/webshare-altroot-form/webshare-altroot-form.component';

export interface WebShareTableRow {
  name: string;
  path: string;
  search_indexed?: boolean;
}

@UntilDestroy()
@Component({
  selector: 'ix-webshare-list',
  templateUrl: './webshare-list.component.html',
  styleUrls: ['./webshare-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    IxTableComponent,
    IxTableHeadComponent,
    IxTableBodyComponent,
    EmptyComponent,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class WebShareListComponent implements OnInit {
  readonly requiredRoles = [Role.SharingWrite];

  protected readonly helptext = helptextSharingWebshare;
  protected webShareConfig = signal<WebShareConfig | null>(null);
  protected dataProvider: AsyncDataProvider<WebShareTableRow>;
  protected readonly hasWebShares = computed(() => {
    const config = this.webShareConfig();
    return !!(config?.altroots && Object.keys(config.altroots).length > 0);
  });

  readonly emptyConfig = {
    type: EmptyType.NoPageData,
    title: this.translate.instant('No WebShares configured'),
    message: this.translate.instant('Click the "Add" button to create a WebShare.'),
    buttonText: this.translate.instant('Add WebShare'),
    buttonAction: () => this.doAdd(),
    requiredRoles: this.requiredRoles,
  };

  columns = createTable<WebShareTableRow>([
    textColumn({
      title: this.translate.instant('Name'),
      propertyName: 'name',
    }),
    textColumn({
      title: this.translate.instant('Path'),
      propertyName: 'path',
    }),
    actionsColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.doEdit(row),
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          onClick: (row) => this.doDelete(row),
          requiredRoles: this.requiredRoles,
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => row.name,
    ariaLabels: (row) => [row.name, this.translate.instant('WebShare')],
  });

  constructor(
    private api: ApiService,
    private slideIn: SlideIn,
    private translate: TranslateService,
    private dialog: DialogService,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    this.setDataProvider();
  }

  doAdd(): void {
    const slideInRef$ = this.slideIn.open(WebShareAltrootFormComponent, {
      data: { isNew: true, name: '', path: '' },
    });

    slideInRef$
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => {
        this.loadWebShareConfig();
      });
  }

  doEdit(row: WebShareTableRow): void {
    const slideInRef$ = this.slideIn.open(WebShareAltrootFormComponent, {
      data: {
        isNew: false,
        name: row.name,
        path: row.path,
        search_indexed: row.search_indexed,
      },
    });

    slideInRef$
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => {
        this.loadWebShareConfig();
      });
  }

  doDelete(row: WebShareTableRow): void {
    this.dialog.confirm({
      title: this.translate.instant(this.helptext.delete_dialog_title),
      message: this.translate.instant(this.helptext.delete_dialog_message, {
        name: row.name,
        path: row.path,
      }),
      buttonText: this.translate.instant('Delete'),
      buttonColor: 'warn',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          const config = this.webShareConfig();
          if (!config) {
            return of(null);
          }

          const updatedAltroots = { ...config.altroots };
          const updatedMetadata = { ...(config.altroots_metadata || {}) };
          delete updatedAltroots[row.name];
          delete updatedMetadata[row.name];

          return this.api.call('webshare.update', [{
            altroots: updatedAltroots,
            altroots_metadata: updatedMetadata,
          }]);
        }),
        untilDestroyed(this),
      )
      .subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('WebShare deleted'));
          this.loadWebShareConfig();
        },
        error: (error: unknown) => {
          this.dialog.error({
            title: this.translate.instant('Error deleting WebShare'),
            message: (error as Error).message,
          });
        },
      });
  }

  private setDataProvider(): void {
    const webshares$ = this.api.call('webshare.config').pipe(
      tap((config) => this.webShareConfig.set(config)),
      map((config) => {
        if (!config.altroots) {
          return [];
        }
        return Object.entries(config.altroots).map(([name, path]) => ({
          name,
          path,
          search_indexed: config.altroots_metadata?.[name]?.search_indexed ?? true,
        }));
      }),
      untilDestroyed(this),
    );

    this.dataProvider = new AsyncDataProvider<WebShareTableRow>(webshares$);
    this.dataProvider.load();
  }

  private loadWebShareConfig(): void {
    this.dataProvider.load();
  }
}

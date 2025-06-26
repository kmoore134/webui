import { Router } from '@angular/router';
import { createComponentFactory, mockProvider, Spectator } from '@ngneat/spectator/jest';
import { of } from 'rxjs';
import { mockCall, mockApi } from 'app/core/testing/utils/mock-api.utils';
import { ServiceName } from 'app/enums/service-name.enum';
import { ServiceStatus } from 'app/enums/service-status.enum';
import { Service } from 'app/interfaces/service.interface';
import { WebShareConfig } from 'app/interfaces/webshare-config.interface';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { ApiService } from 'app/modules/websocket/api.service';
import { WebShareCardComponent } from './webshare-card.component';

describe('WebShareCardComponent', () => {
  let spectator: Spectator<WebShareCardComponent>;

  const mockWebShareConfig: WebShareConfig = {
    id: 1,
    altroots: {
      documents: '/mnt/tank/documents',
      media: '/mnt/tank/media',
    },
    bulk_download_pool: 'tank',
    search_index_pool: 'tank',
    search_enabled: true,
    enable_web_terminal: false,
  } as WebShareConfig;

  const mockService: Service = {
    id: 10,
    service: ServiceName.WebShare,
    enable: true,
    state: ServiceStatus.Running,
  } as Service;

  const createComponent = createComponentFactory({
    component: WebShareCardComponent,
    providers: [
      mockProvider(SlideIn),
      mockProvider(Router),
      mockApi([
        mockCall('webshare.config', mockWebShareConfig),
        mockCall('service.query', [mockService]),
      ]),
    ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('shows WebShare card with correct count', () => {
    expect(spectator.query('h3 .highlight')).toHaveText('2');
    expect(spectator.query('.service-description')).toHaveText(
      'Provides web-based file access to authorized users. Create WebShares to specific directories.',
    );
  });

  it('shows list of configured WebShares', () => {
    const webshareItems = spectator.queryAll('.webshare-item');
    expect(webshareItems).toHaveLength(2);

    expect(webshareItems[0].querySelector('.webshare-name')).toHaveText('documents');
    expect(webshareItems[0].querySelector('.webshare-path')).toHaveText('/mnt/tank/documents');

    expect(webshareItems[1].querySelector('.webshare-name')).toHaveText('media');
    expect(webshareItems[1].querySelector('.webshare-path')).toHaveText('/mnt/tank/media');
  });

  it('opens add WebShare form when Add button is clicked', () => {
    const slideIn = spectator.inject(SlideIn);

    spectator.click('[ixTest="add-webshare"]');

    expect(slideIn.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { isNew: true } }),
    );
  });

  it('navigates to WebShare list when View All is clicked', () => {
    const router = spectator.inject(Router);

    spectator.click('[ixTest="view-all-webshares"]');

    expect(router.navigate).toHaveBeenCalledWith(['/sharing', 'webshare']);
  });

  it('shows service controls', () => {
    expect(spectator.query('ix-service-state-button')).toExist();
    expect(spectator.query('ix-service-extra-actions')).toExist();
  });

  it('disables service state button when no WebShares configured', () => {
    spectator.inject(ApiService).call = jest.fn().mockImplementation((method) => {
      if (method === 'webshare.config') {
        return of({ ...mockWebShareConfig, altroots: {} });
      }
      return of([mockService]);
    });

    spectator.detectChanges();

    const serviceButton = spectator.query('ix-service-state-button');
    expect(serviceButton).toHaveAttribute('disabled', '');
  });
});

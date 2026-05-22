import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  describe('getHello', () => {
    it('returns orchestrator greeting', () => {
      expect(service.getHello()).toBe('Swap Orchestrator API');
    });
  });
});

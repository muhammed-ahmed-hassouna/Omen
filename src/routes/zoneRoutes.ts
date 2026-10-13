import { Router } from 'express';
import { ZoneController } from '../controllers/ZoneController';

export const zoneRouter = Router();

zoneRouter.get('/', ZoneController.getZones);
zoneRouter.get('/cities', ZoneController.getCities);
zoneRouter.post('/', ZoneController.createZone);
zoneRouter.post('/bulk', ZoneController.createZonesBulk);
zoneRouter.put('/:id', ZoneController.updateZone);
zoneRouter.post('/:id/toggle', ZoneController.toggleZoneActive);
zoneRouter.delete('/:id', ZoneController.deleteZone);

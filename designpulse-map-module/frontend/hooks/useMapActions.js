import { useMapStore } from '@/store/useMapStore';
import { useUIStore } from '@/store/useUIStore';

export function useMapActions({ onUpdateZone, onCreateZone, onDeleteZone } = {}) {
  const activeSheetId = useMapStore(s => s.activeSheetId);
  const toolMode = useMapStore(s => s.toolMode);
  
  const setSavingZoneId = useMapStore(s => s.setSavingZoneId);
  const savingZoneId = useMapStore(s => s.savingZoneId);
  const editingZoneId = useMapStore(s => s.editingZoneId);
  const setEditingZoneId = useMapStore(s => s.setEditingZoneId);
  const pendingPolygonPoints = useMapStore(s => s.pendingPolygonPoints);
  const setPendingPolygonPoints = useMapStore(s => s.setPendingPolygonPoints);

  const newZoneName = useUIStore(s => s.newUnitName); // Assuming UI store will also be refactored or kept generic
  const setNewZoneName = useUIStore(s => s.setNewUnitName);
  const setZoneNamingOpen = useUIStore(s => s.setUnitNamingOpen);
  const zoneNamingOpen = useUIStore(s => s.unitNamingOpen);
  const setConfirmModal = useUIStore(s => s.setConfirmModal);
  const confirmModal = useUIStore(s => s.confirmModal);
  const setToast = useUIStore(s => s.setToast);
  const toast = useUIStore(s => s.toast);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePolygonComplete = (points) => {
    setPendingPolygonPoints(points);
    setNewZoneName('');
    setZoneNamingOpen(true);
  };

  const handleUpdateZonePolygon = async (zoneId, newPoints) => {
    if (onUpdateZone) {
      try {
        await onUpdateZone(zoneId, { polygon_coordinates: newPoints });
      } catch (err) {
        showToast('Error updating zone geometry: ' + err.message, 'error');
      }
    }
  };

  const handleDuplicateZone = async (zone) => {
    if (!zone) return;
    
    const newPoints = zone.polygon_coordinates.map(p => ({
      pctX: p.pctX + 0.02,
      pctY: p.pctY + 0.02
    }));
    
    setPendingPolygonPoints(newPoints);
    setNewZoneName(`${zone.zoneId || zone.unit_number} (Copy)`);
    setZoneNamingOpen(true);
  };

  const handleRenameZoneInitiate = (zone) => {
     if (!zone) return;
     setEditingZoneId(zone.id);
     setNewZoneName(zone.zoneId || zone.unit_number);
     setZoneNamingOpen(true);
  };

  const saveNewZoneFromPopover = async () => {
    const name = newZoneName.trim();
    if (!name) return;
    if (!editingZoneId && !pendingPolygonPoints) return;

    try {
      if (editingZoneId) {
         if (onUpdateZone) {
            await onUpdateZone(editingZoneId, { zoneId: name });
         }
         setZoneNamingOpen(false);
         setEditingZoneId(null);
         setNewZoneName('');
         showToast('Zone renamed.', 'success');
      } else {
         if (onCreateZone) {
            await onCreateZone({ 
              sheet_id: activeSheetId, 
              zoneId: name, 
              polygon_coordinates: pendingPolygonPoints 
            });
         }
         setZoneNamingOpen(false);
         setPendingPolygonPoints(null);
         setNewZoneName('');
         showToast('Zone saved.', 'success');
      }
    } catch (err) {
      showToast('Error saving zone: ' + err.message, 'error');
    }
  };

  const cancelZoneNaming = () => {
    setZoneNamingOpen(false);
    setPendingPolygonPoints(null);
    setEditingZoneId(null);
    setNewZoneName('');
  };

  const handleDeleteZone = (zoneId) => {
    setConfirmModal({
      message: 'Are you sure you want to delete this zone markup?',
      onConfirm: async () => {
        try {
          if (onDeleteZone) {
            await onDeleteZone(zoneId);
          }
          showToast('Zone deleted successfully.', 'success');
        } catch (err) {
          showToast('Error deleting zone: ' + err.message, 'error');
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  return {
    zoneNamingOpen, setZoneNamingOpen,
    newZoneName, setNewZoneName,
    editingZoneId, savingZoneId,
    confirmModal, setConfirmModal,
    toast, setToast,
    handlePolygonComplete,
    handleUpdateZonePolygon,
    handleDuplicateZone,
    handleRenameZoneInitiate,
    saveNewZoneFromPopover,
    cancelZoneNaming,
    handleDeleteZone
  };
}

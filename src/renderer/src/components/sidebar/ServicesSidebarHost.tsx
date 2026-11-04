import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { ServicesDrawer } from '@/components/services/ServicesDrawer'

type ServicesSidebarHostProps = {
  sidebarOpen: boolean
  workspaceBoardOpen: boolean
  closeWorkspaceBoard: () => void
  leftSidebarStyle?: React.CSSProperties
  statusBarVisible: boolean
}

/** Fork ahmeedatm/orca: keeps the Services drawer exclusive with the other companion panels. */
export default function ServicesSidebarHost({
  sidebarOpen,
  workspaceBoardOpen,
  closeWorkspaceBoard,
  leftSidebarStyle,
  statusBarVisible
}: ServicesSidebarHostProps): React.JSX.Element | null {
  const drawerOpen = useAppStore((s) => s.servicesDrawerOpen)
  const setDrawerOpen = useAppStore((s) => s.setServicesDrawerOpen)
  const agentDashboardOpen = useAppStore((s) => s.agentDashboardDrawerOpen)

  useEffect(() => {
    if (!sidebarOpen && drawerOpen) {
      setDrawerOpen(false)
    }
  }, [drawerOpen, setDrawerOpen, sidebarOpen])
  useEffect(() => {
    if (drawerOpen) {
      closeWorkspaceBoard()
    }
  }, [closeWorkspaceBoard, drawerOpen])
  // Why two effects: each reacts only when its own panel opens, never on an unrelated change.
  useEffect(() => {
    if (workspaceBoardOpen) {
      setDrawerOpen(false)
    }
  }, [setDrawerOpen, workspaceBoardOpen])
  useEffect(() => {
    if (agentDashboardOpen) {
      setDrawerOpen(false)
    }
  }, [agentDashboardOpen, setDrawerOpen])

  return sidebarOpen ? (
    <ServicesDrawer leftSidebarStyle={leftSidebarStyle} statusBarVisible={statusBarVisible} />
  ) : null
}

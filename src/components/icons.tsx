import * as React from 'react'
import DashboardOutlined from '@mui/icons-material/DashboardOutlined'
import SwapVertOutlined from '@mui/icons-material/SwapVertOutlined'
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import CategoryOutlined from '@mui/icons-material/CategoryOutlined'
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined'
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import AppsRounded from '@mui/icons-material/AppsRounded'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import Google from '@mui/icons-material/Google'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'

type IconProps = { size?: number; className?: string; style?: React.CSSProperties }

const withSize = (El: React.ComponentType<any>) => ({ size = 20, className, style, ...rest }: IconProps) => (
  <El className={className} style={{ fontSize: size, ...(style || {}) }} {...rest} />
)

export const IconBrand = withSize(AppsRounded)
export const IconDashboard = withSize(DashboardOutlined)
export const IconTransactions = withSize(SwapVertOutlined)
export const IconAccounts = withSize(AccountBalanceWalletOutlined)
export const IconCategories = withSize(CategoryOutlined)
export const IconParties = withSize(PeopleAltOutlined)
export const IconReports = withSize(AssessmentOutlined)
export const IconSignOut = withSize(LogoutOutlined)
export const IconGoogle = withSize(Google)
export const IconExport = withSize(FileDownloadOutlined)
export const IconSettings = withSize(SettingsOutlined)

export type ApiDate = string
export type ApiDateTime = string
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE'
export type RoomType = 'CTF' | 'PATH'
export type Role = 'USER' | 'ADMIN' | 'EXPERT'
export type FriendshipStatus = 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'SELF'

export interface AuthResponse {
  token: string
}

export interface ActivityDto {
  date: ApiDate
  count: number
}

export interface BadgeDto {
  id: number
  name: string
  description: string
  icon: string
  earnedAt: ApiDateTime | null
  earned: boolean
  rarityPercentage: number
}

export interface FriendDto {
  id: number
  username: string
  points: number
  streak: number
}

export interface FriendRequestDto {
  id: number
  requesterUsername: string
  createdAt: ApiDateTime
}

export interface HintDto {
  id: number
  description: string
}

export interface PathRoomMiniDto {
  id: number
  title: string
  solved: boolean
  locked: boolean
  requiresVpn: boolean
}

export interface PathRoomsMiniResponse {
  pathId: number
  rooms: PathRoomMiniDto[]
}

export interface PathSummaryDto {
  id: number
  title: string
  description: string
  bannerUrl: string | null
  hasBanner: boolean
  roomsCount: number
  enrolled: boolean
}

export interface PathProgressDto {
  id: number
  title: string
  description: string
  bannerUrl: string | null
  totalRooms: number
  solvedRooms: number
  completed: boolean
}

export interface PathDetailDto {
  id: number
  title: string
  description: string
  bannerUrl: string | null
  hasBanner: boolean
  enrolled: boolean
  rooms: RoomSummaryDto[]
}

export interface PathAdminDetailDto {
  id: number
  title: string
  description: string
  bannerUrl: string | null
  hasBanner: boolean
  roomIds: number[]
}

export interface RoomTaskDto {
  id: number
  title: string
  content: string
  question: string
  completed: boolean
}

export interface RoomSummaryDto {
  id: number
  title: string
  shortDescription: string
  difficulty: DifficultyLevel
  category: string
  points: number
  solutionsCount: number
  solved: boolean
  locked: boolean
  requiresVpn: boolean
  roomType: RoomType
  createdAt: ApiDateTime
}

export interface RoomDetailDto {
  id: number
  title: string
  description: string
  shortDescription: string
  difficulty: DifficultyLevel
  points: number
  solutionsCount: number
  createdAt: ApiDateTime
  solved: boolean
  requiresVpn: boolean
  hints: HintDto[]
  unlockedHintIds: number[]
  fileName: string | null
  tasks: RoomTaskDto[]
}

export interface RoomDto {
  id: number
  title: string
  description: string
  shortDescription: string
  difficulty: DifficultyLevel
  category: string
  points: number
  solutionsCount: number
  solved: boolean
  requiresVpn: boolean
  createdAt: ApiDateTime
  updatedAt: ApiDateTime | null
}

export interface RoomAdminSummaryDto {
  id: number
  title: string
  category: string
  difficulty: DifficultyLevel
  points: number
  requiresVpn: boolean
  roomType: RoomType
}

export interface RoomAdminDto {
  id: number
  title: string
  description: string
  shortDescription: string
  difficulty: DifficultyLevel
  category: string
  points: number
  flag: string
  solutionsCount: number
  requiresVpn: boolean
  roomType: RoomType
  hints: string[]
  createdAt: ApiDateTime
  updatedAt: ApiDateTime | null
}

export interface SolveRoomResponse {
  success: boolean
  message: string
  pointsEarned: number
  newBadges: BadgeDto[]
}

export interface RecentSolvedRoomDto {
  roomId: number
  title: string
  difficulty: DifficultyLevel
  points: number
  solvedAt: ApiDateTime
}

export interface RankingEntry {
  rankPoints: number | null
  rankElo: number | null
  username: string
  points: number
  elo: number
}

export interface RankingUser {
  id: number
  username: string
  email: string
  role: Role
  points: number
  streak: number
  bio: string
  createdAt: ApiDateTime
}

export interface RankingSummaryDto {
  ranking: RankingEntry[]
  user: RankingUser | null
  myRank: RankingEntry | null
}

export interface DashboardUser extends RankingUser {
  hasVpnAccess: boolean
}

export interface DashboardSummaryDto {
  user: DashboardUser
  myRank: RankingEntry | null
  ranking: RankingEntry[]
  recentSolved: RecentSolvedRoomDto[]
  activeSecondsThisWeek: number
  badgesEarnedCount: number
  friendsCount: number
  recommendedPath: PathSummaryDto | null
  pathsProgress: PathProgressDto[]
  currentPath: PathProgressDto | null
  currentPathRoomsMini: PathRoomMiniDto[]
}

export interface UserAdminView {
  id: number
  username: string
  email: string
  role: Role
  createdAt: ApiDateTime
}

export interface UserProfileDto {
  username: string
  points: number
  role: Role
  createdAt: ApiDateTime
  streak: number
  bio: string | null
  badges: BadgeDto[]
}

export interface UserSearchDto {
  id: number
  username: string
  points: number
  friendshipStatus: FriendshipStatus
  winsAgainst: number
  lossesAgainst: number
}

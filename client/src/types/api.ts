export type ApiDate = string
export type ApiDateTime = string
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE'
export type RoomType = 'CTF' | 'PATH'
export type Role = 'USER' | 'ADMIN' | 'EXPERT'
export type FriendshipStatus = 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'SELF'

export interface AuthResponse {
  token: string
}

export type ApiId = string | number

export interface ApiError {
  message?: string
  mutedUntil?: ApiDateTime
  [key: string]: unknown
}

export interface MessageResponse {
  message: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {
  username: string
}

export interface RoomWriteRequest {
  title: string
  description: string
  shortDescription?: string | null
  difficulty: DifficultyLevel
  category: string
  points: number
  flag: string
  requiresVpn: boolean
  roomType?: RoomType
  hints?: string[] | null
}

export interface PathMetaRequest {
  title: string
  description: string
  bannerUrl: string | null
}

export interface CreatePathRequest extends PathMetaRequest {
  roomIds: number[]
}

export interface ChallengeRequest {
  targetUsername: string
  vpnEnabled?: boolean
}

export interface Challenge {
  challengerAvatarSeed?: string
  targetAvatarSeed?: string
  id: string
  challengerId: number
  challengerUsername: string
  targetId: number
  targetUsername: string
  createdAt: ApiDateTime
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  vpnEnabled: boolean
}

export interface GameSession {
  player1AvatarSeed?: string
  player2AvatarSeed?: string
  id: string
  player1Id: number
  player1Username: string
  player1Elo: number | null
  player2Id: number
  player2Username: string
  player2Elo: number | null
  roomId: number
  startTime: ApiDateTime
  status: 'ACTIVE' | 'FINISHED' | 'WAITING_FOR_OPPONENT'
  winnerId: number | null
  player1EloChange: number | null
  player2EloChange: number | null
  hintsUsed: Record<string, number[]>
  finishTimes: Record<string, ApiDateTime>
  penaltiesInSeconds: Record<string, number>
}

export interface ArenaSolveResponse extends MessageResponse {
  success: boolean
  status?: 'WAITING' | 'FINISHED'
}

export interface ChatMessage {
  id: number
  gameId: string
  senderId: number
  senderUsername: string
  content: string
  reported: boolean
  timestamp: ApiDateTime
}

export interface VpnStatus {
  canDownload: boolean
  levelRequirementMet: boolean
  tutorialRequirementMet: boolean
  currentLevel: number
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
  progress?: {
    current: number
    target: number
    conditionType: 'POINTS' | 'STREAK' | 'SOLVED_COUNT' | 'FRIENDS_COUNT'
  } | null
}

export interface FriendDto {
  avatarSeed?: string
  id: number
  username: string
  points: number
  streak: number
}

export interface FriendRequestDto {
  avatarSeed?: string
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
  avatarSeed?: string
  rankPoints: number | null
  rankElo: number | null
  username: string
  points: number
  elo: number
}

export interface RankingUser {
  avatarSeed?: string
  tagline?: string
  interests?: string[]
  featuredBadgeIds?: number[]
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

export interface ProfilePortfolioDto {
  practiceAreas: { category: string; solvedRooms: number }[];
  completedPaths: { id: number; title: string; roomsCount: number }[];
}

export interface UserProfileDto {
  avatarSeed?: string
  tagline?: string
  interests?: string[]
  featuredBadgeIds?: number[]
  username: string
  points: number
  role: Role
  createdAt: ApiDateTime
  streak: number
  bio: string | null
  badges: BadgeDto[]
}

export interface ProfileStatsDto {
  completedPaths: number
  solvedRooms: number
  unlockedHints: number
  earnedBadges: number
  arenaRating: number
}

export interface UserSearchDto {
  avatarSeed?: string
  id: number
  username: string
  points: number
  friendshipStatus: FriendshipStatus
  winsAgainst: number
  lossesAgainst: number
}

export interface AvatarConfig {
  outfit: string
  hair: string
  hat: string
  skin: string
  hairColor: string
  topColor: string
  bottomColor: string
  shoesColor: string
  hatColor: string
  pose?: string
}

export type ApiDate = string
export type ApiDateTime = string
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE'
export type RoomType = 'CTF' | 'PATH'
export type Role = 'USER' | 'ADMIN' | 'EXPERT'
export type FriendshipStatus = 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'SELF'

export type ApiId = string | number

export type ArenaQuestionCategory = 'WEB' | 'SIECI' | 'KRYPTOGRAFIA' | 'LINUX' | 'OGOLNE'

export type ArenaQuestionDifficulty = 'VERY_EASY' | 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD'

export interface ArenaQuestionRequest {
  content: string
  correctAnswer: string
  wrongAnswers: string[]
  category: ArenaQuestionCategory
  difficulty: ArenaQuestionDifficulty
  version?: number
}

export interface ArenaQuestionAdmin extends ArenaQuestionRequest {
  id: number
  version: number
}

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
}

export interface Challenge {
  challengerAvatar?: AvatarConfig | null
  targetAvatar?: AvatarConfig | null
  id: string
  challengerId: number
  challengerUsername: string
  targetId: number
  targetUsername: string
  createdAt: ApiDateTime
  expiresAt: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
}

export interface BattleQuestion {
  id: number
  content: string
  category: string
  answers: string[]
}

export interface RoundResult {
  round: number
  questionId: number
  content: string
  answers: string[]
  correctAnswer: number
  choices: Record<string, number>
  damage: Record<string, number>
}

export interface GameSession {
  player1Avatar?: AvatarConfig | null
  player2Avatar?: AvatarConfig | null
  id: string
  player1Id: number
  player1Username: string
  player1Elo: number | null
  player2Id: number
  player2Username: string
  player2Elo: number | null
  startTime: ApiDateTime
  status: 'ACTIVE' | 'FINISHED'
  winnerId: number | null
  finishReason: 'KNOCKOUT' | 'ROUNDS' | 'SURRENDER' | 'DISCONNECT' | 'ABANDONED' | 'CANCELLED' | null
  player1EloChange: number | null
  player2EloChange: number | null
  round: number
  totalRounds: number
  phase: 'QUESTION' | 'REVEAL'
  roundEndsAt: number
  nextRoundAt: number
  serverTime: number
  hp: Record<string, number>
  answeredBy: number[]
  question: BattleQuestion | null
  lastRound: RoundResult | null
  reactions?: ArenaReaction[]
  pause?: ArenaPause | null
  pausesUsed?: number[]
  absences?: Record<string, ArenaAbsence>
}

export interface ArenaPause {
  players: number[]
  startedAt: number
  endsAt: number
}

export interface ArenaAbsence {
  reason: 'LEFT' | 'DISCONNECTED'
  since: number
}

export interface ArenaReaction {
  id: number
  senderId: number
  reaction: string
  sentAt: number
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
  avatar?: AvatarConfig | null
  id: number
  username: string
  points: number
  streak: number
  online: boolean
  winsAgainst?: number
  lossesAgainst?: number
}

export interface FriendRequestDto {
  avatar?: AvatarConfig | null
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
  published?: boolean;
  contentRevision?: number;
  id: number
  title: string
  description: string
  bannerUrl: string | null
  hasBanner: boolean
  roomsCount: number
  enrolled: boolean
  systemKey?: string | null
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

export type PathUnlockMode = 'OPEN' | 'CHAPTER' | 'ROOM'

export interface PathChapterDto {
  id: number
  title: string
  totalRooms: number
  solvedRooms: number
  locked?: boolean
  rooms: RoomSummaryDto[]
}

export interface PathDetailDto {
  id: number
  title: string
  description: string
  bannerUrl: string | null
  hasBanner: boolean
  enrolled: boolean
  unlockMode?: PathUnlockMode
  rooms: RoomSummaryDto[]
  chapters: PathChapterDto[]
}

export interface PathChapterAdminDto {
  id: number
  title: string
  roomIds: number[]
}

export interface PathAdminDetailDto {
  published?: boolean;
  contentRevision?: number;
  id: number
  title: string
  description: string
  bannerUrl: string | null
  hasBanner: boolean
  revision: number
  unlockMode?: PathUnlockMode
  chapters: PathChapterAdminDto[]
  systemKey?: string | null
}

export interface ChapterRequest {
  id: number | null
  title: string
  roomIds: number[]
}

export interface UpdatePathChaptersRequest {
  revision: number
  chapters: ChapterRequest[]
}


export interface RoomTaskAdminDto {
  id: number
  title: string
  content: string
  question: string | null
  answer: string | null
}

export interface RoomTasksAdminDto {
  revision: number
  tasks: RoomTaskAdminDto[]
}

export interface RoomTaskRequest {
  id: number | null
  title: string
  content: string
  question: string | null
  answer: string | null
}

export type StatsRange = 7 | 30 | 90

export interface AdminStatsDto {
  totals: {
    users: number
    solves: number
    activeThisWeek: number
    pendingReports: number
  }
  rangeDays: StatsRange
  timeline: { date: ApiDate; registrations: number; solves: number }[]
  solvesBySource: { key: string; label: string; count: number }[]
  recentSolves: {
    username: string
    roomId: number
    roomTitle: string
    roomType: RoomType
    pathTitle: string | null
    solvedAt: ApiDateTime
  }[]
}

export interface RoomTaskDto {
  id: number
  title: string
  content: string
  question: string | null
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
  published?: boolean;
  contentRevision?: number;
  id: number
  title: string
  category: string
  difficulty: DifficultyLevel
  points: number
  requiresVpn: boolean
  roomType: RoomType
  pathId: number | null
  pathTitle: string | null
}

export interface RoomAdminDto {
  published?: boolean;
  contentRevision?: number;
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
  avatar?: AvatarConfig | null
  rankPoints: number | null
  rankElo: number | null
  username: string
  points: number
  elo: number
}

export interface RankingUser {
  avatar?: AvatarConfig | null
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
  onboarding?: OnboardingState
  notificationPreferences?: import('../services/userApi').NotificationPreferences
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
  avatar?: AvatarConfig | null
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
  avatar?: AvatarConfig | null
  id: number
  username: string
  points: number
  friendshipStatus: FriendshipStatus
  winsAgainst: number
  lossesAgainst: number
}

export type TourStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED'

export interface OnboardingState {
  avatarConfirmed: boolean
  tourStatus: TourStatus
}

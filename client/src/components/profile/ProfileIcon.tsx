import type { IconProps } from '@phosphor-icons/react/dist/lib/types';
import { TerminalWindowIcon } from '@phosphor-icons/react/dist/csr/TerminalWindow';
import { CodeBlockIcon } from '@phosphor-icons/react/dist/csr/CodeBlock';
import { FingerprintIcon } from '@phosphor-icons/react/dist/csr/Fingerprint';
import { CircuitryIcon } from '@phosphor-icons/react/dist/csr/Circuitry';
import { FireSimpleIcon } from '@phosphor-icons/react/dist/csr/FireSimple';
import { FireIcon } from '@phosphor-icons/react/dist/csr/Fire';
import { GraphIcon } from '@phosphor-icons/react/dist/csr/Graph';
import { MedalIcon } from '@phosphor-icons/react/dist/csr/Medal';
import { CalendarDotsIcon } from '@phosphor-icons/react/dist/csr/CalendarDots';
import { PencilSimpleLineIcon } from '@phosphor-icons/react/dist/csr/PencilSimpleLine';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { LockKeyIcon } from '@phosphor-icons/react/dist/csr/LockKey';

const icons = {
  terminal: TerminalWindowIcon,
  code: CodeBlockIcon,
  shield: FingerprintIcon,
  elite: CircuitryIcon,
  flame: FireSimpleIcon,
  streak: FireIcon,
  network: GraphIcon,
  award: MedalIcon,
  calendar: CalendarDotsIcon,
  edit: PencilSimpleLineIcon,
  close: XIcon,
  left: CaretLeftIcon,
  right: CaretRightIcon,
  check: CheckIcon,
  earned: CheckCircleIcon,
  lock: LockKeyIcon,
};

export type ProfileIconKind = keyof typeof icons;

export default function ProfileIcon({ kind, weight = 'duotone', size = 18, className = 'profile-ui-icon', ...props }: IconProps & { kind: ProfileIconKind }) {
  const Icon = icons[kind];
  return <Icon {...props} size={size} weight={weight} className={className} aria-hidden="true" focusable="false" />;
}

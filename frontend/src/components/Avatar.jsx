import { initials } from '../utils/format';

// Initials avatar drawn locally. No employee names are ever sent to outside websites.
export default function Avatar({ name, size = 'md' }) {
  return (
    <span className={'avatar avatar-' + size} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

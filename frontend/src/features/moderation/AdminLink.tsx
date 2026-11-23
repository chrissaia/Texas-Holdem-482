import { Link } from 'react-router-dom'

/** The server supplies the current viewer's staff flag; APIs still enforce permissions. */
export function AdminLink({ isAdmin, className }: { isAdmin: boolean; className: string }) {
  return isAdmin ? <Link className={className} to="/moderation">Administration</Link> : null
}

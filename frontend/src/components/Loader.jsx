export default function Loader({ full = false, text = 'Loading...' }) {
  return (
    <div className={full ? 'loader-wrap loader-full' : 'loader-wrap'} role="status">
      <div className="loader" />
      <p>{text}</p>
    </div>
  );
}

export function Flash({error,notice}:{error?:string;notice?:string}){return <>{error&&<div className="error mb-4">{error}</div>}{notice&&<div className="success mb-4">{notice}</div>}</>}

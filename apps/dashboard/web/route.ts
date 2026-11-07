import { useEffect, useState } from "react"

const readRoute = (): string => window.location.hash.replace(/^#\/?/, "")

export const useRoute = (): string => {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])
  return route
}

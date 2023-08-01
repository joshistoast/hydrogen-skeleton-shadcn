import { Outlet } from "@remix-run/react";

export default function Auth () {
  return (
    <div className="container p-4 mx-auto">
      <Outlet />
    </div>
  );
}

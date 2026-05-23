import { redirect } from 'next/navigation'

// /our-story → /blog/starchitect-dead (permanent redirect)
export default function OurStoryRedirect() {
  redirect('/blog/starchitect-dead')
}

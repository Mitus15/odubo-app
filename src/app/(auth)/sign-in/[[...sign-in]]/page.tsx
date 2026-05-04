import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0d0c0b] flex items-center justify-center p-4">
      <SignIn 
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/mymoments"
        appearance={{
          variables: {
            colorPrimary: '#843c2d',
            colorBackground: '#1a1918',
            colorInputBackground: '#252221',
            colorInputText: '#ede8df',
            colorText: '#ede8df',
            colorTextSecondary: '#b2a491',
            borderRadius: '8px',
          },
          elements: {
            card: 'bg-[#1a1918] border border-[#502d26]/30',
            headerTitle: 'text-[#ede8df]',
            headerSubtitle: 'text-[#b2a491]',
            socialButtonsBlockButton: 'bg-[#252221] border border-[#502d26]/30 text-[#ede8df] hover:bg-[#2d2a27]',
            formFieldLabel: 'text-[#b2a491]',
            formFieldInput: 'bg-[#252221] border border-[#502d26]/30 text-[#ede8df]',
            formButtonPrimary: 'bg-[#843c2d] hover:bg-[#9a4636] text-white',
            footerActionLink: 'text-[#843c2d] hover:text-[#9a4636]',
          },
        }}
      />
    </div>
  );
}

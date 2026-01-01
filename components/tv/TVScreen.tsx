import {ReactNode} from 'react';

type TVScreenProps = {
    children: ReactNode;
};

export default function TVScreen({children}: TVScreenProps) {
    return (
        <>
            {children}
        </>
    );
}

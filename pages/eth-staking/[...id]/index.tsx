import { useRouter } from "next/router";

export async function getServerSideProps(context: any) {
    const { id } = context.params;
    console.log(id);
    return {
        props: { id },
    };
}

export default function Test({ id }: { id: string }) {
    return <div>id: {id}</div>;
}
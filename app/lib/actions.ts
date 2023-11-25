'use server';

import { sql } from "@vercel/postgres";
import { signIn } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer',
    }),
    amount: z.coerce.number().gt(0, { message: 'Amount must be greater than 0' }),
    status: z.enum(['pending', 'paid'], { invalid_type_error: 'Please select a status' }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(precState: State, formData: FormData) {
    // const rawFromData = {
    //     customerId: formdata.get('customerId'),
    //     amount: formdata.get('amount'),
    //     status: formdata.get('status'),
    // }
    // console.log(rawFromData);

    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Failed to create invoice',
        };
    }
    const { customerId, amount, status } = validatedFields.data;


    const amountIncent = amount * 100;
    const date = new Date().toISOString().split('T')[0];
    try {
        await sql`
        INSERT INTO invoices
            (customer_id, amount, status, date)
        VALUES
            (${customerId}, ${amountIncent}, ${status}, ${date})
    `;
    } catch (error) {
        return {
            message: 'Failed to create invoice',
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');


}

export async function updateInvoice(id: string, formData: FormData) {
    try {
        const { customerId, amount, status } = UpdateInvoice.parse({
            customerId: formData.get('customerId'),
            amount: formData.get('amount'),
            status: formData.get('status'),
        });

        const amountInCents = amount * 100;

        await sql`
          UPDATE invoices
          SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
          WHERE id = ${id}
        `;

        revalidatePath('/dashboard/invoices');
        redirect('/dashboard/invoices');
    } catch (error) {
        return {
            message: 'Failed to update invoice',
        };
    }
}


export async function deleteInvoice(id: string) {
    // throw new Error('Failed to Delete Invoice');
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
    } catch (error) {
        return {
            message: 'Failed to delete invoice',
        };
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', Object.fromEntries(formData));
    } catch (error) {
      if ((error as Error).message.includes('CredentialsSignin')) {
        return 'CredentialsSignin';
      }
      throw error;
    }
  }
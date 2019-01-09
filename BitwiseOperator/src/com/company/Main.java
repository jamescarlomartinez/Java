package com.company;

public class Main {

    public static void main(String[] args) {
	int a = 20;
	int b = 15;
	int c;

	System.out.println("a ="+a + "\n" +"b ="+ b);

	c = a & b;
	System.out.println("a & b = "+ c);

	c = a | b;
	System.out.println("a | b = "+ c);

	c = a ^ b;
	System.out.println("a ^ b = "+ c);

	c = a << 3;
	System.out.println("a << 3 = "+ c);

	c = b >> 2;
	System.out.println("b >> 2 = "+ c);




    }
}
